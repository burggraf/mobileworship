# Local Network Communication Design

**Date:** 2024-12-26
**Status:** Approved

## Overview

Implement local network (WebSocket + mDNS) communication between client and host apps, with Supabase Realtime as fallback. This provides low-latency control for live worship services while maintaining reliability.

## Goals

- **Low latency** for slide control during live services
- **Works offline** if internet drops but local network remains
- **Seamless fallback** to Supabase Realtime when local unavailable
- **Secure** authentication via Supabase JWT
- **Multi-display** synchronized control

## Architecture

### Connection Strategy: Parallel with Local Preference

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT APP                               │
├─────────────────────────────────────────────────────────────────┤
│  ConnectionManager                                               │
│  ├── RemoteConnection (Supabase Realtime) ─── always connected  │
│  └── LocalConnection (WebSocket) ─────────── preferred when up  │
│                                                                  │
│  Command routing:                                                │
│  - If local connected → send via WebSocket                      │
│  - Else → send via Supabase broadcast                           │
│  - State updates received from both, local takes precedence     │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
   ┌─────────────┐                         ┌─────────────┐
   │ Local WiFi  │                         │  Supabase   │
   │ WebSocket   │                         │  Realtime   │
   └──────┬──────┘                         └──────┬──────┘
          │                                       │
          └───────────────────┬───────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         HOST APP                                 │
├─────────────────────────────────────────────────────────────────┤
│  - Runs WebSocket server on local network                       │
│  - Advertises via mDNS (_mobileworship._tcp)                    │
│  - Reports local IP to Supabase (displays.local_ip)             │
│  - Subscribes to Supabase Realtime (fallback commands)          │
│  - Deduplicates commands received from both channels            │
└─────────────────────────────────────────────────────────────────┘
```

### Host Discovery

Dual approach for reliability:

1. **Database IP lookup** - Host reports local IP to Supabase. Client reads it for fast direct connection.
2. **mDNS advertisement** - Host advertises `_mobileworship._tcp` service. Client scans as backup if DB IP fails.

### Display Selection

- Churches have `default_display_ids` for typical setup
- Events can override with `display_ids` column
- `NULL` display_ids = use church defaults
- Empty array = no displays (preview mode)

## Host-Side Implementation

### Startup Sequence

```typescript
1. Generate/load persistent WebSocket port (default: 8765)
2. Start WebSocket server on 0.0.0.0:{port}
3. Advertise via mDNS:
   - Service type: _mobileworship._tcp
   - Service name: display-{displayId}
   - Port: {port}
   - TXT record: { displayId, churchId, name }
4. Report local IP to Supabase:
   - Update displays.local_ip = detected IP
   - Update displays.local_port = port
5. Subscribe to Supabase Realtime (existing behavior)
```

### Platform-Specific WebSocket Servers

| Platform | Implementation |
|----------|----------------|
| Android/Android TV | `react-native-tcp-socket` or native module wrapping `java.net.ServerSocket` |
| macOS | Native module wrapping `Network.framework` NWListener |
| Windows | Native module wrapping `Windows.Networking.Sockets` |

### Command Deduplication

Host receives commands from both WebSocket and Realtime. To prevent double-execution:

- Each command includes a `commandId` (UUID)
- Host tracks last 50 command IDs in memory
- Duplicate IDs within 5 seconds are ignored

## Client-Side Implementation

### Connection Sequence

```typescript
1. Get event's displays (event.display_ids or church defaults)
2. For each display:
   a. Subscribe to Supabase Realtime channel (immediate)
   b. Read display.local_ip and display.local_port from DB
   c. Attempt WebSocket connection to local IP (parallel)
   d. Simultaneously scan mDNS for display-{displayId} (backup)
3. First successful local connection wins
4. Update UI indicator: "local" or "cloud"
```

### Command Routing

```typescript
class ConnectionManager {
  private localConnections: Map<displayId, WebSocket>
  private remoteChannel: RealtimeChannel

  sendCommand(command: ClientCommand) {
    const commandId = uuid()
    const payload = { ...command, commandId }

    // Send to ALL displays for this event
    for (const displayId of this.targetDisplays) {
      const local = this.localConnections.get(displayId)
      if (local?.readyState === OPEN) {
        local.send(payload)  // Prefer local
      } else {
        this.remoteChannel.send('command', payload)  // Fallback
      }
    }
  }
}
```

### Reconnection Logic

- If local WebSocket drops, attempt reconnect every 5 seconds
- Realtime stays connected as hot standby
- Commands seamlessly route to Realtime during local outage

### Web Client

mDNS doesn't work in browsers. Web client strategy:

1. Read `local_ip` from database
2. Attempt WebSocket to that IP (may fail due to mixed content/CORS)
3. Fall back to Supabase Realtime only

For web, Realtime will be the primary path.

## Database Schema Changes

### displays table

```sql
ALTER TABLE displays ADD COLUMN local_ip inet;
ALTER TABLE displays ADD COLUMN local_port integer DEFAULT 8765;
ALTER TABLE displays ADD COLUMN local_ip_updated_at timestamptz;
```

### churches table

```sql
ALTER TABLE churches ADD COLUMN default_display_ids uuid[] DEFAULT '{}';
```

### events table

```sql
ALTER TABLE events ADD COLUMN display_ids uuid[];
-- NULL = use church defaults, empty array = no displays, populated = specific displays
```

### Helper function

```sql
CREATE FUNCTION get_event_displays(event_id uuid)
RETURNS uuid[] AS $$
  SELECT COALESCE(
    NULLIF(e.display_ids, '{}'),  -- Event override (if not empty)
    c.default_display_ids         -- Church defaults
  )
  FROM events e
  JOIN churches c ON c.id = e.church_id
  WHERE e.id = event_id;
$$ LANGUAGE sql STABLE;
```

### IP Update Frequency

- Host updates `local_ip` on startup and when network changes
- Also refreshes every 5 minutes as heartbeat
- `local_ip_updated_at` lets client know if IP is stale (> 10 min = probably offline locally)

## Protocol Changes

### Command ID for Deduplication

```typescript
// Add commandId to all commands
export type ClientCommand =
  | { type: 'LOAD_EVENT'; eventId: string; commandId: string }
  | { type: 'NEXT_SLIDE'; commandId: string }
  // ... etc
```

### Local Authentication Messages

```typescript
// Auth request from client
export interface LocalAuthMessage {
  type: 'AUTH';
  token: string;      // Supabase JWT
  displayId: string;  // Which display client wants to control
}

// Auth response from host
export interface LocalAuthResponse {
  type: 'AUTH_RESULT';
  success: boolean;
  error?: 'INVALID_TOKEN' | 'WRONG_CHURCH' | 'DISPLAY_MISMATCH';
}
```

### Authentication Flow

```
Client                          Host
   │                              │
   ├──── WebSocket connect ──────►│
   │                              │
   ├──── AUTH { token, displayId }►│
   │                              ├── Decode JWT (no verify)
   │                              ├── Extract church_id from JWT
   │                              ├── Check church_id matches host's
   │                              ├── Check displayId matches host's
   │◄─── AUTH_RESULT { success } ─┤
   │                              │
   ├──── COMMAND { ... } ────────►│  (only if auth succeeded)
```

JWT signature verification is skipped on local network for performance. The church_id check prevents cross-church access.

## mDNS Discovery

### Service Advertisement (Host)

```typescript
import Zeroconf from 'react-native-zeroconf';

const zeroconf = new Zeroconf();

zeroconf.publishService(
  'tcp',
  'mobileworship',
  `display-${displayId}`,
  port,
  {
    displayId,
    churchId,
    name: displayName,
    version: '1'
  }
);
```

### Service Discovery (Client)

```typescript
const zeroconf = new Zeroconf();
zeroconf.scan('mobileworship', 'tcp');

zeroconf.on('resolved', (service) => {
  if (service.name === `display-${targetDisplayId}`) {
    const { host, port } = service;
    connectWebSocket(host, port);
  }
});

setTimeout(() => zeroconf.stop(), 5000);
```

## Connection UI Indicator

### Visual States

| State | Icon | Label | Description |
|-------|------|-------|-------------|
| Local | 🟢 | Local | Fast, on same network |
| Cloud | 🔵 | Cloud | Connected via internet |
| Connecting | 🟡 | Connecting | Establishing connection |
| Offline | 🔴 | Offline | No connection to display |

### Component API

```typescript
interface ConnectionStatus {
  state: 'connected' | 'connecting' | 'disconnected';
  type: 'local' | 'remote' | null;
  latency?: number;
}

<ConnectionIndicator status={connectionStatus} />
```

### Behavior

- Tapping indicator shows tooltip with details
- If disconnected, shows "Tap to retry" option
- Multi-display: Show worst-case status (if any display is cloud-only, show "Cloud")

## Implementation Phases

### Phase 1: Database & Protocol (Foundation)

- Add `local_ip`, `local_port`, `local_ip_updated_at` to displays table
- Add `default_display_ids` to churches table
- Add `display_ids` to events table
- Add `commandId` to protocol messages
- Create `get_event_displays()` function

### Phase 2: Host WebSocket Server

- Implement platform-specific WebSocket server (Android first)
- Add local IP detection and reporting to Supabase
- Add mDNS advertisement via react-native-zeroconf
- Add command deduplication logic
- Keep existing RealtimeService as parallel receiver

### Phase 3: Client ConnectionManager

- Create unified `ConnectionManager` class
- Implement parallel Realtime + local connection strategy
- Add local IP lookup from database
- Add mDNS discovery (mobile apps only)
- Implement command routing logic

### Phase 4: UI Integration

- Add `ConnectionIndicator` component
- Wire up to control screens
- Add display selection to event create/edit forms
- Add default display configuration to church settings

### Phase 5: Web Client

- Adapt ConnectionManager for browser (Realtime-primary)
- Optional: attempt local WebSocket if same-origin/HTTPS allows

## Security Considerations

- JWT authentication prevents unauthorized access
- Church ID check prevents cross-church control
- Local network assumed semi-trusted (typical church WiFi)
- Supabase Realtime provides encrypted fallback path

## Future Considerations

- Full JWT verification if security requirements increase
- WebRTC for even lower latency (more complex)
- Mesh networking between multiple hosts
