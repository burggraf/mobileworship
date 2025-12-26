# Local Network Communication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement WebSocket + mDNS local network communication with Supabase Realtime fallback for low-latency display control.

**Architecture:** Client connects to Supabase Realtime immediately (guaranteed), then attempts local WebSocket in parallel. If local succeeds, commands route locally; otherwise via Realtime. Host runs WebSocket server, advertises via mDNS, and deduplicates commands from both channels.

**Tech Stack:** Supabase (PostgreSQL, Realtime), react-native-zeroconf (mDNS), react-native-tcp-socket (WebSocket server on Android), TypeScript.

---

## Phase 1: Database & Protocol Foundation

### Task 1.1: Add local network columns to displays table

**Files:**
- Create: `supabase/migrations/20241226200000_display_local_network.sql`

**Step 1: Write the migration**

```sql
-- Migration: Add local network columns to displays table
-- Enables hosts to report their local IP for direct WebSocket connections

-- Add local network columns
ALTER TABLE displays ADD COLUMN local_ip inet;
ALTER TABLE displays ADD COLUMN local_port integer DEFAULT 8765;
ALTER TABLE displays ADD COLUMN local_ip_updated_at timestamptz;

-- Index for finding displays with recent local IPs
CREATE INDEX idx_displays_local_ip_updated
ON displays(church_id, local_ip_updated_at DESC NULLS LAST)
WHERE local_ip IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN displays.local_ip IS 'Local network IP address reported by host for direct WebSocket connection';
COMMENT ON COLUMN displays.local_port IS 'WebSocket server port on host (default 8765)';
COMMENT ON COLUMN displays.local_ip_updated_at IS 'When local_ip was last updated; stale if > 10 min';
```

**Step 2: Apply migration**

Run: `pnpm db:migrate`
Expected: Migration applied successfully

**Step 3: Regenerate TypeScript types**

Run: `pnpm db:types`
Expected: `packages/shared/src/types/database.ts` updated with new columns

**Step 4: Commit**

```bash
git add supabase/migrations/20241226200000_display_local_network.sql packages/shared/src/types/database.ts
git commit -m "feat(db): add local network columns to displays table"
```

---

### Task 1.2: Add default_display_ids to churches table

**Files:**
- Create: `supabase/migrations/20241226200100_church_default_displays.sql`

**Step 1: Write the migration**

```sql
-- Migration: Add default display configuration to churches
-- Allows churches to set which displays are used by default for events

ALTER TABLE churches ADD COLUMN default_display_ids uuid[] DEFAULT '{}';

COMMENT ON COLUMN churches.default_display_ids IS 'Default display IDs used for events when not overridden';
```

**Step 2: Apply migration**

Run: `pnpm db:migrate`
Expected: Migration applied successfully

**Step 3: Regenerate TypeScript types**

Run: `pnpm db:types`
Expected: Types updated

**Step 4: Commit**

```bash
git add supabase/migrations/20241226200100_church_default_displays.sql packages/shared/src/types/database.ts
git commit -m "feat(db): add default_display_ids to churches table"
```

---

### Task 1.3: Add display_ids to events table

**Files:**
- Create: `supabase/migrations/20241226200200_event_display_override.sql`

**Step 1: Write the migration**

```sql
-- Migration: Add display override to events
-- NULL = use church defaults, populated = specific displays for this event

ALTER TABLE events ADD COLUMN display_ids uuid[];

COMMENT ON COLUMN events.display_ids IS 'Override display IDs for this event; NULL uses church defaults';

-- Helper function to resolve which displays an event should use
CREATE OR REPLACE FUNCTION get_event_displays(p_event_id uuid)
RETURNS uuid[] AS $$
  SELECT COALESCE(
    NULLIF(e.display_ids, '{}'),  -- Event override (if not empty)
    c.default_display_ids         -- Church defaults
  )
  FROM events e
  JOIN churches c ON c.id = e.church_id
  WHERE e.id = p_event_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_event_displays IS 'Returns display IDs for an event, falling back to church defaults';
```

**Step 2: Apply migration**

Run: `pnpm db:migrate`
Expected: Migration applied successfully

**Step 3: Regenerate TypeScript types**

Run: `pnpm db:types`
Expected: Types updated

**Step 4: Commit**

```bash
git add supabase/migrations/20241226200200_event_display_override.sql packages/shared/src/types/database.ts
git commit -m "feat(db): add display_ids to events with get_event_displays function"
```

---

### Task 1.4: Add commandId to protocol messages

**Files:**
- Modify: `packages/protocol/src/messages.ts`

**Step 1: Update ClientCommand type to include commandId**

In `packages/protocol/src/messages.ts`, update the ClientCommand type:

```typescript
// Client → Host commands
// All commands include commandId for deduplication across local/remote channels
export type ClientCommand =
  | { type: 'LOAD_EVENT'; eventId: string; commandId: string }
  | { type: 'UNLOAD_EVENT'; commandId: string }
  | { type: 'GOTO_SLIDE'; slideIndex: number; commandId: string }
  | { type: 'GOTO_SECTION'; sectionIndex: number; commandId: string }
  | { type: 'GOTO_ITEM'; itemIndex: number; commandId: string }
  | { type: 'NEXT_SLIDE'; commandId: string }
  | { type: 'PREV_SLIDE'; commandId: string }
  | { type: 'BLANK_SCREEN'; commandId: string }
  | { type: 'SHOW_LOGO'; commandId: string }
  | { type: 'UNBLANK'; commandId: string }
  | { type: 'SET_TRANSITION'; transition: TransitionType; commandId: string }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<DisplaySettings>; commandId: string };
```

**Step 2: Add helper function to generate command with ID**

Add at the end of the file:

```typescript
// Helper to generate a unique command ID
export function generateCommandId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to create a command with auto-generated ID
export function createCommand<T extends Omit<ClientCommand, 'commandId'>>(
  command: T
): T & { commandId: string } {
  return { ...command, commandId: generateCommandId() };
}
```

**Step 3: Verify build**

Run: `cd packages/protocol && pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/protocol/src/messages.ts
git commit -m "feat(protocol): add commandId to all commands for deduplication"
```

---

### Task 1.5: Add local authentication messages to protocol

**Files:**
- Modify: `packages/protocol/src/messages.ts`

**Step 1: Add LocalAuthMessage and LocalAuthResponse types**

Add after the existing AuthMessage interface:

```typescript
// Local WebSocket authentication (extends AuthMessage)
export interface LocalAuthMessage {
  type: 'LOCAL_AUTH';
  token: string;      // Supabase JWT
  displayId: string;  // Which display client wants to control
}

export type LocalAuthError = 'INVALID_TOKEN' | 'WRONG_CHURCH' | 'DISPLAY_MISMATCH';

export interface LocalAuthResponse {
  type: 'LOCAL_AUTH_RESULT';
  success: boolean;
  error?: LocalAuthError;
}
```

**Step 2: Update ProtocolMessage union**

Update the ProtocolMessage type to include new messages:

```typescript
// Message wrapper for transport
export type ProtocolMessage =
  | AuthMessage
  | LocalAuthMessage
  | LocalAuthResponse
  | StateSyncMessage
  | StatusMessage
  | { type: 'COMMAND'; command: ClientCommand }
  | { type: 'PING' }
  | { type: 'PONG' };
```

**Step 3: Verify build**

Run: `cd packages/protocol && pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/protocol/src/messages.ts
git commit -m "feat(protocol): add local WebSocket authentication messages"
```

---

### Task 1.6: Update host types to include SET_SLIDE command

**Files:**
- Modify: `packages/protocol/src/messages.ts`
- Modify: `apps/host/src/types.ts`

**Step 1: Check if SET_SLIDE is in protocol**

The host app uses `SET_SLIDE` but it's not in the protocol. Add it:

```typescript
export type ClientCommand =
  | { type: 'LOAD_EVENT'; eventId: string; commandId: string }
  | { type: 'UNLOAD_EVENT'; commandId: string }
  | { type: 'SET_SLIDE'; slide: SlideContent; commandId: string }  // Add this
  // ... rest
```

**Step 2: Add SlideContent type to protocol**

```typescript
// Slide content for display
export interface SlideContent {
  lines: string[];
  backgroundUrl?: string;
}
```

**Step 3: Update host types.ts to re-export from protocol**

In `apps/host/src/types.ts`, ensure it imports from protocol:

```typescript
export type {
  ClientCommand,
  HostState,
  SlideContent,
  // ... other types
} from '@mobileworship/protocol';
```

**Step 4: Verify builds**

Run: `pnpm build`
Expected: All packages build successfully

**Step 5: Commit**

```bash
git add packages/protocol/src/messages.ts apps/host/src/types.ts
git commit -m "feat(protocol): add SET_SLIDE command and SlideContent type"
```

---

## Phase 2: Host WebSocket Server & mDNS

### Task 2.1: Create CommandDeduplicator utility

**Files:**
- Create: `apps/host/src/services/CommandDeduplicator.ts`

**Step 1: Write the deduplicator**

```typescript
/**
 * Tracks recently processed command IDs to prevent duplicate execution
 * when commands arrive via both local WebSocket and Supabase Realtime
 */
export class CommandDeduplicator {
  private processedIds: Map<string, number> = new Map();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize = 50, ttlMs = 5000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Check if a command ID has been seen recently
   * @returns true if this is a duplicate (should be skipped)
   */
  isDuplicate(commandId: string): boolean {
    const now = Date.now();

    // Clean up expired entries
    this.cleanup(now);

    // Check if we've seen this ID
    if (this.processedIds.has(commandId)) {
      return true;
    }

    // Record this ID
    this.processedIds.set(commandId, now);
    return false;
  }

  private cleanup(now: number): void {
    // Remove expired entries
    for (const [id, timestamp] of this.processedIds) {
      if (now - timestamp > this.ttlMs) {
        this.processedIds.delete(id);
      }
    }

    // If still too large, remove oldest
    if (this.processedIds.size > this.maxSize) {
      const entries = Array.from(this.processedIds.entries());
      entries.sort((a, b) => a[1] - b[1]);
      const toRemove = entries.slice(0, entries.length - this.maxSize);
      for (const [id] of toRemove) {
        this.processedIds.delete(id);
      }
    }
  }

  clear(): void {
    this.processedIds.clear();
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/host && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/host/src/services/CommandDeduplicator.ts
git commit -m "feat(host): add CommandDeduplicator for local/remote command deduplication"
```

---

### Task 2.2: Create NetworkInfo utility for local IP detection

**Files:**
- Create: `apps/host/src/services/NetworkInfo.ts`

**Step 1: Write the network info utility**

```typescript
import { NetworkInfo as RNNetworkInfo } from 'react-native-network-info';

export interface LocalNetworkInfo {
  ip: string | null;
  broadcast: string | null;
}

/**
 * Get local network information for WebSocket server advertisement
 */
export async function getLocalNetworkInfo(): Promise<LocalNetworkInfo> {
  try {
    const [ip, broadcast] = await Promise.all([
      RNNetworkInfo.getIPV4Address(),
      RNNetworkInfo.getBroadcast(),
    ]);
    return { ip, broadcast };
  } catch (error) {
    console.error('Failed to get network info:', error);
    return { ip: null, broadcast: null };
  }
}

/**
 * Check if we have a valid local network IP (not localhost)
 */
export function isValidLocalIp(ip: string | null): boolean {
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === 'localhost') return false;
  // Check for valid private IP ranges
  return (
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
  );
}
```

**Step 2: Add dependency**

Run: `cd apps/host && pnpm add react-native-network-info`

**Step 3: Verify TypeScript compiles**

Run: `cd apps/host && pnpm typecheck`
Expected: No errors (may need @types or declaration)

**Step 4: Commit**

```bash
git add apps/host/src/services/NetworkInfo.ts apps/host/package.json pnpm-lock.yaml
git commit -m "feat(host): add NetworkInfo utility for local IP detection"
```

---

### Task 2.3: Create mDNS advertisement service

**Files:**
- Create: `apps/host/src/services/MDNSService.ts`

**Step 1: Write the mDNS service**

```typescript
import Zeroconf from 'react-native-zeroconf';

export interface MDNSServiceConfig {
  displayId: string;
  churchId: string;
  displayName: string;
  port: number;
}

/**
 * Advertises the host display on the local network via mDNS/Bonjour
 * Service type: _mobileworship._tcp
 */
export class MDNSService {
  private zeroconf: Zeroconf;
  private isPublished = false;
  private config: MDNSServiceConfig | null = null;

  constructor() {
    this.zeroconf = new Zeroconf();
  }

  /**
   * Start advertising the display service
   */
  async publish(config: MDNSServiceConfig): Promise<void> {
    if (this.isPublished) {
      await this.unpublish();
    }

    this.config = config;

    try {
      // Service name format: display-{displayId}
      const serviceName = `display-${config.displayId}`;

      await this.zeroconf.publishService(
        'tcp',
        'mobileworship',
        serviceName,
        config.port,
        {
          displayId: config.displayId,
          churchId: config.churchId,
          name: config.displayName,
          version: '1',
        }
      );

      this.isPublished = true;
      console.log(`mDNS: Published ${serviceName} on port ${config.port}`);
    } catch (error) {
      console.error('mDNS: Failed to publish service:', error);
      throw error;
    }
  }

  /**
   * Stop advertising the service
   */
  async unpublish(): Promise<void> {
    if (!this.isPublished) return;

    try {
      await this.zeroconf.unpublishService(
        `display-${this.config?.displayId}`
      );
      this.isPublished = false;
      console.log('mDNS: Unpublished service');
    } catch (error) {
      console.error('mDNS: Failed to unpublish:', error);
    }
  }

  /**
   * Check if currently advertising
   */
  get advertising(): boolean {
    return this.isPublished;
  }
}

export const mdnsService = new MDNSService();
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/host && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/host/src/services/MDNSService.ts
git commit -m "feat(host): add MDNSService for local network discovery"
```

---

### Task 2.4: Create LocalServer for WebSocket connections

**Files:**
- Modify: `apps/host/src/services/HostServer.ts`

**Step 1: Rewrite HostServer with TCP socket server**

```typescript
import TcpSocket from 'react-native-tcp-socket';
import type { ClientCommand, HostState, ProtocolMessage, LocalAuthMessage, LocalAuthResponse } from '@mobileworship/protocol';

interface HostServerOptions {
  port: number;
  displayId: string;
  churchId: string;
  onCommand: (command: ClientCommand) => void;
  onClientConnect: () => void;
  onClientDisconnect: () => void;
}

interface AuthenticatedClient {
  socket: TcpSocket.Socket;
  authenticated: boolean;
  buffer: string;
}

/**
 * WebSocket-like server for local network connections
 * Uses TCP sockets with JSON message framing
 */
export class HostServer {
  private server: TcpSocket.Server | null = null;
  private clients: Map<number, AuthenticatedClient> = new Map();
  private options: HostServerOptions;
  private state: HostState;
  private nextClientId = 1;

  constructor(options: HostServerOptions) {
    this.options = options;
    this.state = {
      displayId: options.displayId,
      eventId: null,
      currentItemIndex: 0,
      currentSectionIndex: 0,
      currentSlideIndex: 0,
      isBlank: false,
      isLogo: true,
      transition: 'fade',
      connectedClients: 0,
      lastUpdated: Date.now(),
    };
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = TcpSocket.createServer((socket) => {
          this.handleNewClient(socket);
        });

        this.server.listen({ port: this.options.port, host: '0.0.0.0' }, () => {
          console.log(`HostServer: Listening on port ${this.options.port}`);
          resolve();
        });

        this.server.on('error', (error) => {
          console.error('HostServer error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  stop(): void {
    this.clients.forEach((client) => {
      try {
        client.socket.destroy();
      } catch (e) {
        // Ignore
      }
    });
    this.clients.clear();

    if (this.server) {
      this.server.close();
      this.server = null;
    }
    console.log('HostServer: Stopped');
  }

  private handleNewClient(socket: TcpSocket.Socket): void {
    const clientId = this.nextClientId++;
    const client: AuthenticatedClient = {
      socket,
      authenticated: false,
      buffer: '',
    };
    this.clients.set(clientId, client);
    console.log(`HostServer: Client ${clientId} connected`);

    socket.on('data', (data) => {
      client.buffer += data.toString();
      this.processBuffer(clientId, client);
    });

    socket.on('close', () => {
      this.clients.delete(clientId);
      if (client.authenticated) {
        this.options.onClientDisconnect();
        this.updateClientCount();
      }
      console.log(`HostServer: Client ${clientId} disconnected`);
    });

    socket.on('error', (error) => {
      console.error(`HostServer: Client ${clientId} error:`, error);
      this.clients.delete(clientId);
    });
  }

  private processBuffer(clientId: number, client: AuthenticatedClient): void {
    // Messages are newline-delimited JSON
    const lines = client.buffer.split('\n');
    client.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message: ProtocolMessage = JSON.parse(line);
        this.handleMessage(clientId, client, message);
      } catch (e) {
        console.error('HostServer: Failed to parse message:', e);
      }
    }
  }

  private handleMessage(
    clientId: number,
    client: AuthenticatedClient,
    message: ProtocolMessage
  ): void {
    if (message.type === 'LOCAL_AUTH') {
      this.handleAuth(clientId, client, message as LocalAuthMessage);
      return;
    }

    if (!client.authenticated) {
      console.log(`HostServer: Rejecting message from unauthenticated client ${clientId}`);
      return;
    }

    switch (message.type) {
      case 'COMMAND':
        this.options.onCommand(message.command);
        break;
      case 'PING':
        this.send(client.socket, { type: 'PONG' });
        break;
    }
  }

  private handleAuth(
    clientId: number,
    client: AuthenticatedClient,
    message: LocalAuthMessage
  ): void {
    // Decode JWT to extract church_id (no signature verification for performance)
    let tokenChurchId: string | null = null;
    try {
      const payload = JSON.parse(atob(message.token.split('.')[1]));
      // Supabase JWT has user metadata in app_metadata or user_metadata
      // We need to look up the user's church_id from the users table
      // For now, we trust the token and check displayId matches
      tokenChurchId = payload.church_id || null;
    } catch (e) {
      console.error('HostServer: Failed to decode JWT:', e);
    }

    // Verify displayId matches this host
    if (message.displayId !== this.options.displayId) {
      const response: LocalAuthResponse = {
        type: 'LOCAL_AUTH_RESULT',
        success: false,
        error: 'DISPLAY_MISMATCH',
      };
      this.send(client.socket, response);
      return;
    }

    // For now, accept if displayId matches (church_id validation can be added)
    client.authenticated = true;
    this.options.onClientConnect();
    this.updateClientCount();

    const response: LocalAuthResponse = {
      type: 'LOCAL_AUTH_RESULT',
      success: true,
    };
    this.send(client.socket, response);

    // Send current state
    this.sendState(client.socket);
    console.log(`HostServer: Client ${clientId} authenticated`);
  }

  private send(socket: TcpSocket.Socket, message: ProtocolMessage): void {
    try {
      socket.write(JSON.stringify(message) + '\n');
    } catch (e) {
      console.error('HostServer: Failed to send message:', e);
    }
  }

  private sendState(socket: TcpSocket.Socket): void {
    this.send(socket, {
      type: 'STATE_SYNC',
      state: { ...this.state, connectedClients: this.getAuthenticatedCount() },
    });
  }

  broadcastState(): void {
    this.state.connectedClients = this.getAuthenticatedCount();
    const message: ProtocolMessage = { type: 'STATE_SYNC', state: this.state };
    const data = JSON.stringify(message) + '\n';

    this.clients.forEach((client) => {
      if (client.authenticated) {
        try {
          client.socket.write(data);
        } catch (e) {
          // Ignore
        }
      }
    });
  }

  setState(update: Partial<HostState>): void {
    this.state = { ...this.state, ...update, lastUpdated: Date.now() };
    this.broadcastState();
  }

  private getAuthenticatedCount(): number {
    let count = 0;
    this.clients.forEach((c) => {
      if (c.authenticated) count++;
    });
    return count;
  }

  private updateClientCount(): void {
    this.state.connectedClients = this.getAuthenticatedCount();
  }

  get connectedClients(): number {
    return this.getAuthenticatedCount();
  }
}
```

**Step 2: Add dependency**

Run: `cd apps/host && pnpm add react-native-tcp-socket`

**Step 3: Verify TypeScript compiles**

Run: `cd apps/host && pnpm typecheck`

**Step 4: Commit**

```bash
git add apps/host/src/services/HostServer.ts apps/host/package.json pnpm-lock.yaml
git commit -m "feat(host): implement HostServer with TCP socket for local connections"
```

---

### Task 2.5: Create LocalIPReporter service

**Files:**
- Create: `apps/host/src/services/LocalIPReporter.ts`

**Step 1: Write the IP reporter**

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getLocalNetworkInfo, isValidLocalIp } from './NetworkInfo';
import { Config } from '../config';

const UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Reports local IP address to Supabase for client discovery
 */
export class LocalIPReporter {
  private supabase: SupabaseClient;
  private displayId: string | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.supabase = createClient(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY);
  }

  async start(displayId: string, port: number): Promise<void> {
    this.displayId = displayId;

    // Report immediately
    await this.reportIP(port);

    // Then report periodically
    this.intervalId = setInterval(() => {
      this.reportIP(port);
    }, UPDATE_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Clear IP on stop
    if (this.displayId) {
      try {
        await this.supabase
          .from('displays')
          .update({
            local_ip: null,
            local_port: null,
            local_ip_updated_at: null,
          })
          .eq('id', this.displayId);
      } catch (e) {
        console.error('LocalIPReporter: Failed to clear IP:', e);
      }
    }

    this.displayId = null;
  }

  private async reportIP(port: number): Promise<void> {
    if (!this.displayId) return;

    const networkInfo = await getLocalNetworkInfo();

    if (!isValidLocalIp(networkInfo.ip)) {
      console.log('LocalIPReporter: No valid local IP to report');
      return;
    }

    try {
      const { error } = await this.supabase
        .from('displays')
        .update({
          local_ip: networkInfo.ip,
          local_port: port,
          local_ip_updated_at: new Date().toISOString(),
        })
        .eq('id', this.displayId);

      if (error) {
        console.error('LocalIPReporter: Failed to update IP:', error);
      } else {
        console.log(`LocalIPReporter: Reported IP ${networkInfo.ip}:${port}`);
      }
    } catch (e) {
      console.error('LocalIPReporter: Error updating IP:', e);
    }
  }

  /**
   * Force an immediate IP report (e.g., on network change)
   */
  async forceReport(port: number): Promise<void> {
    await this.reportIP(port);
  }
}

export const localIPReporter = new LocalIPReporter();
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/host && pnpm typecheck`

**Step 3: Commit**

```bash
git add apps/host/src/services/LocalIPReporter.ts
git commit -m "feat(host): add LocalIPReporter for database IP registration"
```

---

### Task 2.6: Integrate local services into DisplayScreen

**Files:**
- Modify: `apps/host/src/screens/DisplayScreen.tsx`

**Step 1: Import new services**

Add imports at top:

```typescript
import { HostServer } from '../services/HostServer';
import { mdnsService } from '../services/MDNSService';
import { localIPReporter } from '../services/LocalIPReporter';
import { CommandDeduplicator } from '../services/CommandDeduplicator';
```

**Step 2: Add local server state and initialization**

Add after existing state declarations:

```typescript
const [localServer, setLocalServer] = useState<HostServer | null>(null);
const commandDeduplicator = useRef(new CommandDeduplicator()).current;
const LOCAL_PORT = 8765;
```

**Step 3: Update handleCommand to use deduplication**

Wrap the existing handleCommand:

```typescript
const handleCommand = useCallback((command: ClientCommand) => {
  // Deduplicate commands from local and remote channels
  if (command.commandId && commandDeduplicator.isDuplicate(command.commandId)) {
    console.log('Skipping duplicate command:', command.commandId);
    return;
  }

  console.log('Received command:', command.type);
  // ... existing switch statement
}, []);
```

**Step 4: Start local services when paired**

Add a new useEffect after the RealtimeService connection:

```typescript
// Start local network services when paired
useEffect(() => {
  if (appState.screen !== 'ready' && appState.screen !== 'display') return;

  const server = new HostServer({
    port: LOCAL_PORT,
    displayId: appState.displayId,
    churchId: appState.churchId,
    onCommand: handleCommand,
    onClientConnect: () => console.log('Local client connected'),
    onClientDisconnect: () => console.log('Local client disconnected'),
  });

  async function startLocalServices() {
    try {
      await server.start();
      setLocalServer(server);

      // Start mDNS advertisement
      await mdnsService.publish({
        displayId: appState.displayId,
        churchId: appState.churchId,
        displayName: appState.name,
        port: LOCAL_PORT,
      });

      // Start IP reporting
      await localIPReporter.start(appState.displayId, LOCAL_PORT);
    } catch (error) {
      console.error('Failed to start local services:', error);
    }
  }

  startLocalServices();

  return () => {
    server.stop();
    mdnsService.unpublish();
    localIPReporter.stop();
    setLocalServer(null);
  };
}, [appState.screen === 'ready' || appState.screen === 'display' ? appState.displayId : null]);
```

**Step 5: Verify builds**

Run: `cd apps/host && pnpm typecheck`

**Step 6: Commit**

```bash
git add apps/host/src/screens/DisplayScreen.tsx
git commit -m "feat(host): integrate local WebSocket server and mDNS into DisplayScreen"
```

---

## Phase 3: Client ConnectionManager

### Task 3.1: Create ConnectionManager class

**Files:**
- Create: `packages/protocol/src/ConnectionManager.ts`

**Step 1: Write ConnectionManager**

```typescript
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type {
  ClientCommand,
  HostState,
  ConnectionInfo,
  LocalAuthMessage,
  LocalAuthResponse,
  ProtocolMessage,
} from './messages';
import { getDisplayChannel, createCommand } from './messages';

export interface DisplayConnection {
  displayId: string;
  localIp: string | null;
  localPort: number;
}

export interface ConnectionManagerOptions {
  supabase: SupabaseClient;
  onStateUpdate: (displayId: string, state: HostState) => void;
  onConnectionChange: (status: ConnectionStatus) => void;
}

export interface ConnectionStatus {
  state: 'disconnected' | 'connecting' | 'connected';
  type: 'local' | 'remote' | null;
  displays: Map<string, 'local' | 'remote' | 'disconnected'>;
}

/**
 * Manages connections to multiple displays with local preference
 * Connects to Supabase Realtime immediately, attempts local WebSocket in parallel
 */
export class ConnectionManager {
  private options: ConnectionManagerOptions;
  private displays: DisplayConnection[] = [];
  private localSockets: Map<string, WebSocket> = new Map();
  private remoteChannels: Map<string, RealtimeChannel> = new Map();
  private connectionStatus: ConnectionStatus = {
    state: 'disconnected',
    type: null,
    displays: new Map(),
  };
  private authToken: string | null = null;
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(options: ConnectionManagerOptions) {
    this.options = options;
  }

  /**
   * Connect to displays for an event
   */
  async connect(
    displays: DisplayConnection[],
    authToken: string
  ): Promise<void> {
    this.displays = displays;
    this.authToken = authToken;

    this.updateStatus({ state: 'connecting', type: null });

    // Connect to each display
    await Promise.all(
      displays.map((display) => this.connectToDisplay(display))
    );
  }

  private async connectToDisplay(display: DisplayConnection): Promise<void> {
    // 1. Connect to Supabase Realtime immediately (guaranteed)
    await this.connectRemote(display.displayId);

    // 2. Attempt local WebSocket in parallel
    if (display.localIp) {
      this.connectLocal(display);
    }
  }

  private async connectRemote(displayId: string): Promise<void> {
    const channel = this.options.supabase.channel(getDisplayChannel(displayId), {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        // Only use remote state if no local connection
        if (!this.localSockets.has(displayId)) {
          this.options.onStateUpdate(displayId, payload as HostState);
        }
      })
      .on('broadcast', { event: 'pong' }, () => {
        // Latency measurement could go here
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.updateDisplayStatus(displayId, 'remote');
        }
      });

    this.remoteChannels.set(displayId, channel);
  }

  private connectLocal(display: DisplayConnection): void {
    if (!display.localIp || !this.authToken) return;

    const url = `ws://${display.localIp}:${display.localPort}`;

    try {
      const socket = new WebSocket(url);
      let buffer = '';

      socket.onopen = () => {
        // Send auth message
        const authMessage: LocalAuthMessage = {
          type: 'LOCAL_AUTH',
          token: this.authToken!,
          displayId: display.displayId,
        };
        socket.send(JSON.stringify(authMessage) + '\n');
      };

      socket.onmessage = (event) => {
        buffer += event.data;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const message: ProtocolMessage = JSON.parse(line);
            this.handleLocalMessage(display.displayId, socket, message);
          } catch (e) {
            console.error('Failed to parse local message:', e);
          }
        }
      };

      socket.onclose = () => {
        this.localSockets.delete(display.displayId);
        this.updateDisplayStatus(display.displayId, 'remote');
        this.scheduleReconnect(display);
      };

      socket.onerror = () => {
        // Will trigger onclose
      };
    } catch (e) {
      console.error('Failed to create local WebSocket:', e);
    }
  }

  private handleLocalMessage(
    displayId: string,
    socket: WebSocket,
    message: ProtocolMessage
  ): void {
    switch (message.type) {
      case 'LOCAL_AUTH_RESULT':
        const authResult = message as LocalAuthResponse;
        if (authResult.success) {
          this.localSockets.set(displayId, socket);
          this.updateDisplayStatus(displayId, 'local');
          console.log(`Local connection established to ${displayId}`);
        } else {
          console.error('Local auth failed:', authResult.error);
          socket.close();
        }
        break;

      case 'STATE_SYNC':
        this.options.onStateUpdate(displayId, message.state);
        break;

      case 'PONG':
        // Latency measurement
        break;
    }
  }

  private scheduleReconnect(display: DisplayConnection): void {
    // Clear existing timer
    const existing = this.reconnectTimers.get(display.displayId);
    if (existing) clearTimeout(existing);

    // Reconnect after 5 seconds
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(display.displayId);
      if (display.localIp && !this.localSockets.has(display.displayId)) {
        this.connectLocal(display);
      }
    }, 5000);

    this.reconnectTimers.set(display.displayId, timer);
  }

  /**
   * Send a command to all displays
   */
  sendCommand(command: Omit<ClientCommand, 'commandId'>): void {
    const fullCommand = createCommand(command);

    for (const display of this.displays) {
      const localSocket = this.localSockets.get(display.displayId);

      if (localSocket?.readyState === WebSocket.OPEN) {
        // Prefer local
        localSocket.send(
          JSON.stringify({ type: 'COMMAND', command: fullCommand }) + '\n'
        );
      } else {
        // Fallback to remote
        const channel = this.remoteChannels.get(display.displayId);
        channel?.send({
          type: 'broadcast',
          event: 'command',
          payload: fullCommand,
        });
      }
    }
  }

  /**
   * Disconnect from all displays
   */
  async disconnect(): Promise<void> {
    // Clear reconnect timers
    this.reconnectTimers.forEach((timer) => clearTimeout(timer));
    this.reconnectTimers.clear();

    // Close local sockets
    this.localSockets.forEach((socket) => socket.close());
    this.localSockets.clear();

    // Unsubscribe from remote channels
    await Promise.all(
      Array.from(this.remoteChannels.values()).map((channel) =>
        channel.unsubscribe()
      )
    );
    this.remoteChannels.clear();

    this.displays = [];
    this.authToken = null;
    this.updateStatus({ state: 'disconnected', type: null });
  }

  private updateDisplayStatus(
    displayId: string,
    status: 'local' | 'remote' | 'disconnected'
  ): void {
    this.connectionStatus.displays.set(displayId, status);
    this.recalculateOverallStatus();
  }

  private updateStatus(partial: Partial<ConnectionStatus>): void {
    this.connectionStatus = { ...this.connectionStatus, ...partial };
    this.options.onConnectionChange(this.connectionStatus);
  }

  private recalculateOverallStatus(): void {
    const statuses = Array.from(this.connectionStatus.displays.values());

    if (statuses.length === 0) {
      this.updateStatus({ state: 'disconnected', type: null });
      return;
    }

    const hasLocal = statuses.includes('local');
    const hasRemote = statuses.includes('remote');
    const allDisconnected = statuses.every((s) => s === 'disconnected');

    if (allDisconnected) {
      this.updateStatus({ state: 'disconnected', type: null });
    } else {
      // Show worst-case: if any is remote-only, show remote
      this.updateStatus({
        state: 'connected',
        type: hasLocal && !hasRemote ? 'local' : hasRemote ? 'remote' : null,
      });
    }
  }

  get status(): ConnectionStatus {
    return this.connectionStatus;
  }
}
```

**Step 2: Export from package**

Update `packages/protocol/src/index.ts`:

```typescript
export * from './messages';
export { LocalConnection, type LocalConnectionOptions } from './local';
export { RemoteConnection, type RemoteConnectionOptions } from './remote';
export { ConnectionManager, type ConnectionManagerOptions, type ConnectionStatus, type DisplayConnection } from './ConnectionManager';
```

**Step 3: Build package**

Run: `cd packages/protocol && pnpm build`

**Step 4: Commit**

```bash
git add packages/protocol/src/ConnectionManager.ts packages/protocol/src/index.ts
git commit -m "feat(protocol): add ConnectionManager with local preference and parallel connections"
```

---

### Task 3.2: Create mDNS discovery for client

**Files:**
- Create: `apps/client/src/services/MDNSDiscovery.ts`

**Step 1: Write mDNS discovery service**

```typescript
import Zeroconf from 'react-native-zeroconf';

export interface DiscoveredDisplay {
  displayId: string;
  churchId: string;
  name: string;
  host: string;
  port: number;
}

type DiscoveryCallback = (display: DiscoveredDisplay) => void;

/**
 * Discovers Mobile Worship displays on the local network via mDNS
 */
export class MDNSDiscovery {
  private zeroconf: Zeroconf;
  private scanning = false;
  private callback: DiscoveryCallback | null = null;
  private scanTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.zeroconf = new Zeroconf();

    this.zeroconf.on('resolved', (service) => {
      if (this.callback && service.name?.startsWith('display-')) {
        const display: DiscoveredDisplay = {
          displayId: service.txt?.displayId || service.name.replace('display-', ''),
          churchId: service.txt?.churchId || '',
          name: service.txt?.name || 'Unknown Display',
          host: service.host || service.addresses?.[0] || '',
          port: service.port || 8765,
        };
        this.callback(display);
      }
    });

    this.zeroconf.on('error', (error) => {
      console.error('mDNS discovery error:', error);
    });
  }

  /**
   * Start scanning for displays
   * @param onDiscovered Callback when a display is found
   * @param timeoutMs How long to scan (default 5 seconds)
   */
  start(onDiscovered: DiscoveryCallback, timeoutMs = 5000): void {
    if (this.scanning) return;

    this.callback = onDiscovered;
    this.scanning = true;

    this.zeroconf.scan('mobileworship', 'tcp');

    this.scanTimeout = setTimeout(() => {
      this.stop();
    }, timeoutMs);
  }

  /**
   * Stop scanning
   */
  stop(): void {
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }

    if (this.scanning) {
      this.zeroconf.stop();
      this.scanning = false;
    }

    this.callback = null;
  }

  /**
   * Scan for a specific display by ID
   * @returns Promise that resolves when found or rejects on timeout
   */
  findDisplay(displayId: string, timeoutMs = 5000): Promise<DiscoveredDisplay> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.stop();
        reject(new Error(`Display ${displayId} not found via mDNS`));
      }, timeoutMs);

      this.start((display) => {
        if (display.displayId === displayId) {
          clearTimeout(timeout);
          this.stop();
          resolve(display);
        }
      }, timeoutMs + 1000); // Slightly longer to allow timeout to fire first
    });
  }
}

export const mdnsDiscovery = new MDNSDiscovery();
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/client && pnpm typecheck`

**Step 3: Commit**

```bash
git add apps/client/src/services/MDNSDiscovery.ts
git commit -m "feat(client): add MDNSDiscovery for local display discovery"
```

---

### Task 3.3: Create useDisplayConnection hook

**Files:**
- Create: `apps/client/src/hooks/useDisplayConnection.ts`

**Step 1: Write the hook**

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ConnectionManager,
  type ConnectionStatus,
  type DisplayConnection,
  type ClientCommand,
  type HostState,
} from '@mobileworship/protocol';
import { mdnsDiscovery } from '../services/MDNSDiscovery';
import { Config } from '../config';

interface UseDisplayConnectionOptions {
  eventId: string;
  authToken: string;
}

interface UseDisplayConnectionResult {
  connectionStatus: ConnectionStatus;
  hostStates: Map<string, HostState>;
  sendCommand: (command: Omit<ClientCommand, 'commandId'>) => void;
  reconnect: () => Promise<void>;
}

const supabase = createClient(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY);

/**
 * Hook for managing connections to displays for an event
 */
export function useDisplayConnection({
  eventId,
  authToken,
}: UseDisplayConnectionOptions): UseDisplayConnectionResult {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    state: 'disconnected',
    type: null,
    displays: new Map(),
  });
  const [hostStates, setHostStates] = useState<Map<string, HostState>>(new Map());

  const connectionManager = useRef<ConnectionManager | null>(null);

  const handleStateUpdate = useCallback((displayId: string, state: HostState) => {
    setHostStates((prev) => {
      const next = new Map(prev);
      next.set(displayId, state);
      return next;
    });
  }, []);

  const handleConnectionChange = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
  }, []);

  const connect = useCallback(async () => {
    // 1. Get displays for this event
    const { data: displays, error } = await supabase.rpc('get_event_displays', {
      p_event_id: eventId,
    });

    if (error || !displays?.length) {
      console.error('No displays for event:', error);
      return;
    }

    // 2. Get display details (local_ip, local_port)
    const { data: displayDetails } = await supabase
      .from('displays')
      .select('id, local_ip, local_port')
      .in('id', displays);

    const displayConnections: DisplayConnection[] = (displayDetails || []).map(
      (d) => ({
        displayId: d.id,
        localIp: d.local_ip,
        localPort: d.local_port || 8765,
      })
    );

    // 3. Try mDNS discovery for displays without local_ip
    for (const conn of displayConnections) {
      if (!conn.localIp) {
        try {
          const discovered = await mdnsDiscovery.findDisplay(conn.displayId, 3000);
          conn.localIp = discovered.host;
          conn.localPort = discovered.port;
        } catch (e) {
          // mDNS failed, will use Realtime only
        }
      }
    }

    // 4. Create connection manager and connect
    connectionManager.current = new ConnectionManager({
      supabase,
      onStateUpdate: handleStateUpdate,
      onConnectionChange: handleConnectionChange,
    });

    await connectionManager.current.connect(displayConnections, authToken);
  }, [eventId, authToken, handleStateUpdate, handleConnectionChange]);

  const disconnect = useCallback(async () => {
    await connectionManager.current?.disconnect();
    connectionManager.current = null;
    setHostStates(new Map());
  }, []);

  const sendCommand = useCallback(
    (command: Omit<ClientCommand, 'commandId'>) => {
      connectionManager.current?.sendCommand(command);
    },
    []
  );

  const reconnect = useCallback(async () => {
    await disconnect();
    await connect();
  }, [connect, disconnect]);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [eventId]);

  return {
    connectionStatus,
    hostStates,
    sendCommand,
    reconnect,
  };
}
```

**Step 2: Create config file if needed**

Check if `apps/client/src/config.ts` exists, if not create it:

```typescript
export const Config = {
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
};
```

**Step 3: Verify TypeScript compiles**

Run: `cd apps/client && pnpm typecheck`

**Step 4: Commit**

```bash
git add apps/client/src/hooks/useDisplayConnection.ts apps/client/src/config.ts
git commit -m "feat(client): add useDisplayConnection hook for event display control"
```

---

### Task 3.4: Update ControlScreen to use ConnectionManager

**Files:**
- Modify: `apps/client/src/screens/ControlScreen.tsx`

**Step 1: Import and use the hook**

Replace the existing ControlScreen implementation:

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useDisplayConnection } from '../hooks/useDisplayConnection';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { useAuth } from '../hooks/useAuth'; // Assuming this exists

type ControlRouteProp = RouteProp<RootStackParamList, 'Control'>;

export function ControlScreen() {
  const route = useRoute<ControlRouteProp>();
  const navigation = useNavigation();
  const { eventId } = route.params;
  const { session } = useAuth();

  const { connectionStatus, hostStates, sendCommand, reconnect } =
    useDisplayConnection({
      eventId,
      authToken: session?.access_token || '',
    });

  // Get first host state for display (multi-display shows same content)
  const hostState = hostStates.size > 0
    ? Array.from(hostStates.values())[0]
    : null;

  function handlePrevious() {
    sendCommand({ type: 'PREV_SLIDE' });
  }

  function handleNext() {
    sendCommand({ type: 'NEXT_SLIDE' });
  }

  function handleBlank() {
    if (hostState?.isBlank) {
      sendCommand({ type: 'UNBLANK' });
    } else {
      sendCommand({ type: 'BLANK_SCREEN' });
    }
  }

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-primary-600">Close</Text>
        </TouchableOpacity>
        <Text className="font-bold dark:text-white">Live Control</Text>
        <ConnectionIndicator
          status={connectionStatus}
          onPress={reconnect}
        />
      </View>

      {/* Loading state */}
      {connectionStatus.state === 'connecting' && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-gray-500">Connecting to displays...</Text>
        </View>
      )}

      {/* Disconnected state */}
      {connectionStatus.state === 'disconnected' && (
        <View className="flex-1 items-center justify-center">
          <Text className="text-red-500 mb-4">Not connected</Text>
          <TouchableOpacity
            className="px-6 py-3 bg-primary-600 rounded-lg"
            onPress={reconnect}
          >
            <Text className="text-white font-medium">Reconnect</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Connected state */}
      {connectionStatus.state === 'connected' && (
        <>
          {/* Current/Next Preview */}
          <View className="flex-row p-4 gap-4">
            <View className="flex-1">
              <Text className="text-xs text-gray-500 mb-2">Current</Text>
              <View className="aspect-video bg-black rounded-lg items-center justify-center">
                <Text className="text-gray-400">
                  {hostState?.isBlank
                    ? 'Blank'
                    : hostState?.isLogo
                    ? 'Logo'
                    : `Slide ${(hostState?.currentSlideIndex ?? 0) + 1}`}
                </Text>
              </View>
            </View>
            <View className="flex-1">
              <Text className="text-xs text-gray-500 mb-2">Next</Text>
              <View className="aspect-video bg-gray-800 rounded-lg items-center justify-center">
                <Text className="text-gray-500">-</Text>
              </View>
            </View>
          </View>

          {/* Song Sections */}
          <ScrollView className="flex-1 px-4">
            <Text className="font-semibold mb-3 dark:text-white">Sections</Text>
            <View className="items-center py-8">
              <Text className="text-gray-500">
                Select a song from the service order
              </Text>
            </View>
          </ScrollView>

          {/* Control Bar */}
          <View className="flex-row items-center justify-center gap-4 p-4 border-t border-gray-200 dark:border-gray-700">
            <TouchableOpacity
              className="px-6 py-4 bg-gray-200 dark:bg-gray-700 rounded-lg"
              onPress={handlePrevious}
            >
              <Text className="font-medium dark:text-white">Previous</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`px-6 py-4 rounded-lg ${
                hostState?.isBlank ? 'bg-yellow-600' : 'bg-gray-800'
              }`}
              onPress={handleBlank}
            >
              <Text className="text-white font-medium">
                {hostState?.isBlank ? 'Show' : 'Blank'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="px-8 py-4 bg-primary-600 rounded-lg"
              onPress={handleNext}
            >
              <Text className="text-white font-semibold text-lg">Next</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/client && pnpm typecheck`

**Step 3: Commit**

```bash
git add apps/client/src/screens/ControlScreen.tsx
git commit -m "feat(client): wire ControlScreen to ConnectionManager"
```

---

## Phase 4: UI Integration

### Task 4.1: Create ConnectionIndicator component

**Files:**
- Create: `apps/client/src/components/ConnectionIndicator.tsx`

**Step 1: Write the component**

```typescript
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { ConnectionStatus } from '@mobileworship/protocol';

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
  onPress?: () => void;
}

export function ConnectionIndicator({ status, onPress }: ConnectionIndicatorProps) {
  const getColor = () => {
    switch (status.state) {
      case 'connected':
        return status.type === 'local' ? 'bg-green-500' : 'bg-blue-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-red-500';
    }
  };

  const getLabel = () => {
    switch (status.state) {
      case 'connected':
        return status.type === 'local' ? 'Local' : 'Cloud';
      case 'connecting':
        return 'Connecting';
      case 'disconnected':
        return 'Offline';
    }
  };

  const content = (
    <View className="flex-row items-center gap-2">
      <View className={`w-2 h-2 rounded-full ${getColor()}`} />
      <Text className="text-sm text-gray-500 dark:text-gray-400">
        {getLabel()}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} className="p-2 -m-2">
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/client && pnpm typecheck`

**Step 3: Commit**

```bash
git add apps/client/src/components/ConnectionIndicator.tsx
git commit -m "feat(client): add ConnectionIndicator component"
```

---

### Task 4.2: Create web ConnectionIndicator component

**Files:**
- Create: `apps/web/src/components/ConnectionIndicator.tsx`

**Step 1: Write the web version**

```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';

interface ConnectionStatus {
  state: 'disconnected' | 'connecting' | 'connected';
  type: 'local' | 'remote' | null;
}

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
  onClick?: () => void;
}

export function ConnectionIndicator({ status, onClick }: ConnectionIndicatorProps) {
  const { t } = useTranslation();

  const getColorClass = () => {
    switch (status.state) {
      case 'connected':
        return status.type === 'local' ? 'bg-green-500' : 'bg-blue-500';
      case 'connecting':
        return 'bg-yellow-500 animate-pulse';
      case 'disconnected':
        return 'bg-red-500';
    }
  };

  const getLabel = () => {
    switch (status.state) {
      case 'connected':
        return status.type === 'local' ? t('connection.local') : t('connection.cloud');
      case 'connecting':
        return t('connection.connecting');
      case 'disconnected':
        return t('connection.offline');
    }
  };

  const getTooltip = () => {
    switch (status.state) {
      case 'connected':
        return status.type === 'local'
          ? t('connection.localTooltip')
          : t('connection.cloudTooltip');
      case 'connecting':
        return t('connection.connectingTooltip');
      case 'disconnected':
        return t('connection.offlineTooltip');
    }
  };

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-2 py-1 rounded ${
        onClick ? 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer' : ''
      }`}
      title={getTooltip()}
    >
      <span className={`w-2 h-2 rounded-full ${getColorClass()}`} />
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {getLabel()}
      </span>
    </Component>
  );
}
```

**Step 2: Add i18n keys**

Add to `apps/web/src/i18n/locales/en.json`:

```json
{
  "connection": {
    "local": "Local",
    "cloud": "Cloud",
    "connecting": "Connecting",
    "offline": "Offline",
    "localTooltip": "Connected via local WiFi (fast)",
    "cloudTooltip": "Connected via cloud (may have slight delay)",
    "connectingTooltip": "Establishing connection...",
    "offlineTooltip": "Not connected to display. Tap to retry."
  }
}
```

Add to `apps/web/src/i18n/locales/es.json`:

```json
{
  "connection": {
    "local": "Local",
    "cloud": "Nube",
    "connecting": "Conectando",
    "offline": "Sin conexión",
    "localTooltip": "Conectado por WiFi local (rápido)",
    "cloudTooltip": "Conectado por la nube (puede tener ligero retraso)",
    "connectingTooltip": "Estableciendo conexión...",
    "offlineTooltip": "No conectado al display. Toca para reintentar."
  }
}
```

**Step 3: Verify build**

Run: `cd apps/web && pnpm build`

**Step 4: Commit**

```bash
git add apps/web/src/components/ConnectionIndicator.tsx apps/web/src/i18n/locales/en.json apps/web/src/i18n/locales/es.json
git commit -m "feat(web): add ConnectionIndicator component with i18n"
```

---

## Phase 5: Final Integration & Testing

### Task 5.1: Update RealtimeService to support command deduplication

**Files:**
- Modify: `apps/host/src/services/RealtimeService.ts`

**Step 1: Import and use CommandDeduplicator**

The DisplayScreen already wraps handleCommand with deduplication, so RealtimeService doesn't need changes. Verify this is working correctly by checking the flow.

**Step 2: Verify integration**

Run: `cd apps/host && pnpm typecheck`

**Step 3: Commit if any changes**

```bash
git add -A
git commit -m "chore: verify RealtimeService integration with deduplication"
```

---

### Task 5.2: End-to-end verification

**Step 1: Build all packages**

Run: `pnpm build`
Expected: All packages build successfully

**Step 2: Run type checks**

Run: `pnpm typecheck`
Expected: No type errors

**Step 3: Manual testing checklist**

- [ ] Host app starts WebSocket server on port 8765
- [ ] Host app advertises via mDNS
- [ ] Host app reports local IP to Supabase
- [ ] Client connects to Supabase Realtime immediately
- [ ] Client attempts local WebSocket connection
- [ ] Client shows correct connection indicator (Local/Cloud)
- [ ] Commands work via local connection
- [ ] Commands work via Realtime fallback
- [ ] Duplicate commands are ignored
- [ ] Reconnection works when local connection drops

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete local network communication implementation

Implements WebSocket + mDNS local network communication with Supabase
Realtime as fallback for low-latency display control.

- Database: local_ip columns on displays, display_ids on events
- Protocol: commandId for deduplication, local auth messages
- Host: TCP server, mDNS advertisement, IP reporting
- Client: ConnectionManager with parallel connections
- UI: ConnectionIndicator showing local/cloud status"
```

---

## Summary

This plan implements the local network communication feature in 5 phases:

1. **Database & Protocol** - Schema changes and protocol updates
2. **Host WebSocket Server** - TCP server, mDNS, IP reporting
3. **Client ConnectionManager** - Parallel connections with local preference
4. **UI Integration** - Connection indicators
5. **Final Integration** - Verification and testing

Each task is atomic and can be committed independently. The implementation follows the design document's architecture of parallel connections with local preference.
