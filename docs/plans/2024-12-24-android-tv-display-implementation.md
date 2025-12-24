# Android TV Display App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the host app to support Android TV with pairing, Realtime communication, and slide rendering.

**Architecture:** Host app displays a pairing code, gets claimed by a client via edge function, subscribes to Supabase Realtime for commands, caches event data locally, and renders slides. No complex TV UI needed.

**Tech Stack:** React Native 0.74, Supabase (Realtime, Edge Functions, PostgreSQL), TypeScript, react-native-qrcode-svg

---

## Task 1: Database Migration - Displays Table

**Files:**
- Create: `supabase/migrations/20241224120000_displays_table.sql`

**Step 1: Write the migration**

```sql
-- Create displays table for host device management
CREATE TABLE displays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid REFERENCES churches NOT NULL,

  -- Identity
  name text NOT NULL DEFAULT 'Unnamed Display',
  location text,

  -- Pairing
  pairing_code text,
  pairing_code_expires_at timestamptz,
  paired_at timestamptz,

  -- Status
  last_seen_at timestamptz,
  device_info jsonb DEFAULT '{}',

  -- Settings
  default_background_id uuid REFERENCES media,
  settings jsonb DEFAULT '{
    "fontSize": "medium",
    "textPosition": "center",
    "margins": {"top": 5, "bottom": 10, "left": 5, "right": 5},
    "fontFamily": "system",
    "textShadow": true,
    "overlayOpacity": 0.3
  }',

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE displays ENABLE ROW LEVEL SECURITY;

-- Users can view displays for their church
CREATE POLICY "displays_select" ON displays
  FOR SELECT USING (church_id = get_user_church_id());

-- Users can insert displays for their church
CREATE POLICY "displays_insert" ON displays
  FOR INSERT WITH CHECK (church_id = get_user_church_id());

-- Users can update displays for their church
CREATE POLICY "displays_update" ON displays
  FOR UPDATE USING (church_id = get_user_church_id());

-- Users can delete displays for their church
CREATE POLICY "displays_delete" ON displays
  FOR DELETE USING (church_id = get_user_church_id());

-- Service role can manage all displays (for edge functions)
CREATE POLICY "displays_service" ON displays
  FOR ALL USING (auth.role() = 'service_role');

-- Index for pairing code lookups (edge function uses this)
CREATE INDEX idx_displays_pairing_code ON displays(pairing_code)
  WHERE pairing_code IS NOT NULL;

-- Index for church lookups
CREATE INDEX idx_displays_church_id ON displays(church_id);

-- Trigger to update updated_at
CREATE TRIGGER displays_updated_at
  BEFORE UPDATE ON displays
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Step 2: Apply migration locally**

Run: `pnpm db:migrate`
Expected: Migration applies successfully

**Step 3: Regenerate types**

Run: `pnpm db:types`
Expected: `packages/shared/src/types/database.ts` updated with displays table

**Step 4: Commit**

```bash
git add supabase/migrations/20241224120000_displays_table.sql packages/shared/src/types/database.ts
git commit -m "feat(db): add displays table for host device management"
```

---

## Task 2: Shared Types - Display Settings

**Files:**
- Create: `packages/shared/src/types/display.ts`
- Modify: `packages/shared/src/types/index.ts`

**Step 1: Create display types file**

```typescript
// packages/shared/src/types/display.ts

export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type TextPosition = 'center' | 'bottom' | 'lower-third';
export type FontFamily = 'system' | 'serif' | 'sans-serif';

export interface DisplayMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface DisplaySettings {
  fontSize: FontSize;
  textPosition: TextPosition;
  margins: DisplayMargins;
  fontFamily: FontFamily;
  textShadow: boolean;
  overlayOpacity: number;
}

export interface DeviceInfo {
  platform: 'android' | 'android-tv' | 'ios' | 'macos' | 'windows';
  version: string;
  resolution: {
    width: number;
    height: number;
  };
}

export interface Display {
  id: string;
  churchId: string;
  name: string;
  location: string | null;
  pairingCode: string | null;
  pairingCodeExpiresAt: string | null;
  pairedAt: string | null;
  lastSeenAt: string | null;
  deviceInfo: DeviceInfo | null;
  defaultBackgroundId: string | null;
  settings: DisplaySettings;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  fontSize: 'medium',
  textPosition: 'center',
  margins: { top: 5, bottom: 10, left: 5, right: 5 },
  fontFamily: 'system',
  textShadow: true,
  overlayOpacity: 0.3,
};
```

**Step 2: Export from index**

Add to `packages/shared/src/types/index.ts`:

```typescript
export * from './display';
```

**Step 3: Verify types compile**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/shared/src/types/display.ts packages/shared/src/types/index.ts
git commit -m "feat(shared): add display settings types"
```

---

## Task 3: Protocol Updates - New Commands

**Files:**
- Modify: `packages/protocol/src/messages.ts`

**Step 1: Read current file**

Verify current structure before modifying.

**Step 2: Add new message types**

Update `packages/protocol/src/messages.ts`:

```typescript
import type { TransitionType } from '@mobileworship/shared';
import type { DisplaySettings } from '@mobileworship/shared';

// Client → Host commands
export type ClientCommand =
  | { type: 'LOAD_EVENT'; eventId: string }
  | { type: 'UNLOAD_EVENT' }
  | { type: 'GOTO_SLIDE'; slideIndex: number }
  | { type: 'GOTO_SECTION'; sectionIndex: number }
  | { type: 'GOTO_ITEM'; itemIndex: number }
  | { type: 'NEXT_SLIDE' }
  | { type: 'PREV_SLIDE' }
  | { type: 'BLANK_SCREEN' }
  | { type: 'SHOW_LOGO' }
  | { type: 'UNBLANK' }
  | { type: 'SET_TRANSITION'; transition: TransitionType }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<DisplaySettings> };

// Host → Client state updates
export interface HostState {
  displayId: string;
  eventId: string | null;
  currentItemIndex: number;
  currentSectionIndex: number;
  currentSlideIndex: number;
  isBlank: boolean;
  isLogo: boolean;
  transition: TransitionType;
  connectedClients: number;
  lastUpdated: number;
}

// Host → Client status messages
export type HostStatus =
  | { type: 'EVENT_READY'; eventId: string }
  | { type: 'EVENT_LOADING'; progress: number }
  | { type: 'EVENT_ERROR'; message: string }
  | { type: 'DISPLAY_INFO'; name: string; settings: DisplaySettings };

// Authentication message
export interface AuthMessage {
  type: 'AUTH';
  churchId: string;
  userId: string;
  token: string;
}

// State sync message
export interface StateSyncMessage {
  type: 'STATE_SYNC';
  state: HostState;
}

// Status message
export interface StatusMessage {
  type: 'STATUS';
  status: HostStatus;
}

// Connection events
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type ConnectionType = 'local' | 'remote';

export interface ConnectionInfo {
  status: ConnectionStatus;
  type: ConnectionType | null;
  hostId: string | null;
  latency: number | null;
}

// Message wrapper for transport
export type ProtocolMessage =
  | AuthMessage
  | StateSyncMessage
  | StatusMessage
  | { type: 'COMMAND'; command: ClientCommand }
  | { type: 'PING' }
  | { type: 'PONG' };

// Host discovery (for local network)
export interface DiscoveredHost {
  id: string;
  name: string;
  address: string;
  port: number;
  churchId: string;
}

// Realtime channel names
export const getDisplayChannel = (displayId: string) => `display:${displayId}`;
```

**Step 3: Verify types compile**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/protocol/src/messages.ts
git commit -m "feat(protocol): add event loading and display settings commands"
```

---

## Task 4: Edge Function - Display Pairing

**Files:**
- Create: `supabase/functions/display-pairing/index.ts`

**Step 1: Create the edge function**

```typescript
// supabase/functions/display-pairing/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  action: 'generate';
  deviceInfo: {
    platform: string;
    version: string;
    resolution: { width: number; height: number };
  };
}

interface ClaimRequest {
  action: 'claim';
  code: string;
  name: string;
  location?: string;
}

interface VerifyRequest {
  action: 'verify';
  displayId: string;
}

type RequestBody = GenerateRequest | ClaimRequest | VerifyRequest;

function generatePairingCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();

    if (body.action === 'generate') {
      // Generate a new pairing code for an unpaired display
      const pairingCode = generatePairingCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      const { data, error } = await supabase
        .from('displays')
        .insert({
          pairing_code: pairingCode,
          pairing_code_expires_at: expiresAt,
          device_info: body.deviceInfo,
          name: 'Unnamed Display',
        })
        .select('id, pairing_code')
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          displayId: data.id,
          pairingCode: data.pairing_code,
          expiresAt,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.action === 'claim') {
      // Get authenticated user
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authorization required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userClient = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: userData, error: userError } = await userClient
        .from('users')
        .select('church_id')
        .single();

      if (userError || !userData) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find display with matching code that hasn't expired
      const { data: display, error: findError } = await supabase
        .from('displays')
        .select('id')
        .eq('pairing_code', body.code)
        .gt('pairing_code_expires_at', new Date().toISOString())
        .is('paired_at', null)
        .single();

      if (findError || !display) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired pairing code' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Claim the display
      const { data: claimed, error: claimError } = await supabase
        .from('displays')
        .update({
          church_id: userData.church_id,
          name: body.name,
          location: body.location || null,
          pairing_code: null,
          pairing_code_expires_at: null,
          paired_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', display.id)
        .select('id, name, church_id')
        .single();

      if (claimError) throw claimError;

      return new Response(
        JSON.stringify({
          displayId: claimed.id,
          name: claimed.name,
          churchId: claimed.church_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.action === 'verify') {
      // Verify a display is still valid
      const { data, error } = await supabase
        .from('displays')
        .select('id, name, church_id, paired_at, settings')
        .eq('id', body.displayId)
        .not('paired_at', 'is', null)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ valid: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update last_seen_at
      await supabase
        .from('displays')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', body.displayId);

      return new Response(
        JSON.stringify({
          valid: true,
          displayId: data.id,
          name: data.name,
          churchId: data.church_id,
          settings: data.settings,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

**Step 2: Test function locally**

Run: `supabase functions serve display-pairing`
Expected: Function starts without errors

**Step 3: Commit**

```bash
git add supabase/functions/display-pairing/index.ts
git commit -m "feat(edge): add display-pairing function for code generation and claiming"
```

---

## Task 5: Host App - Pairing Service

**Files:**
- Create: `apps/host/src/services/PairingService.ts`
- Create: `apps/host/src/services/RealtimeService.ts`

**Step 1: Create PairingService**

```typescript
// apps/host/src/services/PairingService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Dimensions } from 'react-native';
import type { DeviceInfo, DisplaySettings } from '@mobileworship/shared';

const DISPLAY_ID_KEY = '@mobileworship/display_id';
const SUPABASE_FUNCTIONS_URL = process.env.SUPABASE_URL + '/functions/v1';

interface GenerateResponse {
  displayId: string;
  pairingCode: string;
  expiresAt: string;
}

interface VerifyResponse {
  valid: boolean;
  displayId?: string;
  name?: string;
  churchId?: string;
  settings?: DisplaySettings;
}

export class PairingService {
  private displayId: string | null = null;

  async initialize(): Promise<{ paired: boolean; displayId?: string; name?: string; churchId?: string; settings?: DisplaySettings }> {
    const storedId = await AsyncStorage.getItem(DISPLAY_ID_KEY);

    if (storedId) {
      // Verify the display is still valid
      const verification = await this.verify(storedId);
      if (verification.valid) {
        this.displayId = storedId;
        return {
          paired: true,
          displayId: verification.displayId,
          name: verification.name,
          churchId: verification.churchId,
          settings: verification.settings,
        };
      }
      // Clear invalid display ID
      await AsyncStorage.removeItem(DISPLAY_ID_KEY);
    }

    return { paired: false };
  }

  async generatePairingCode(): Promise<GenerateResponse> {
    const { width, height } = Dimensions.get('window');
    const deviceInfo: DeviceInfo = {
      platform: Platform.isTV ? 'android-tv' : Platform.OS as DeviceInfo['platform'],
      version: Platform.Version?.toString() || 'unknown',
      resolution: { width, height },
    };

    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/display-pairing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate', deviceInfo }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate pairing code');
    }

    const data: GenerateResponse = await response.json();
    this.displayId = data.displayId;

    return data;
  }

  async verify(displayId: string): Promise<VerifyResponse> {
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/display-pairing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', displayId }),
    });

    if (!response.ok) {
      return { valid: false };
    }

    return response.json();
  }

  async savePairing(displayId: string): Promise<void> {
    await AsyncStorage.setItem(DISPLAY_ID_KEY, displayId);
    this.displayId = displayId;
  }

  async clearPairing(): Promise<void> {
    await AsyncStorage.removeItem(DISPLAY_ID_KEY);
    this.displayId = null;
  }

  getDisplayId(): string | null {
    return this.displayId;
  }
}

export const pairingService = new PairingService();
```

**Step 2: Create RealtimeService**

```typescript
// apps/host/src/services/RealtimeService.ts
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import type { ClientCommand, HostState, HostStatus } from '@mobileworship/protocol';
import { getDisplayChannel } from '@mobileworship/protocol';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

type CommandHandler = (command: ClientCommand) => void;
type ClaimHandler = (name: string, churchId: string) => void;

export class RealtimeService {
  private supabase = createClient(supabaseUrl, supabaseAnonKey);
  private channel: RealtimeChannel | null = null;
  private displayId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  async connect(
    displayId: string,
    onCommand: CommandHandler,
    onClaim?: ClaimHandler
  ): Promise<void> {
    this.displayId = displayId;

    // Subscribe to display channel for commands
    this.channel = this.supabase.channel(getDisplayChannel(displayId));

    // Listen for commands from clients
    this.channel.on('broadcast', { event: 'command' }, ({ payload }) => {
      onCommand(payload as ClientCommand);
    });

    // Listen for database changes (for pairing updates)
    if (onClaim) {
      this.channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'displays',
          filter: `id=eq.${displayId}`,
        },
        (payload) => {
          if (payload.new.paired_at && !payload.old.paired_at) {
            onClaim(payload.new.name, payload.new.church_id);
          }
        }
      );
    }

    await this.channel.subscribe();

    // Start heartbeat
    this.startHeartbeat();
  }

  broadcastState(state: HostState): void {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'state',
        payload: state,
      });
    }
  }

  broadcastStatus(status: HostStatus): void {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'status',
        payload: status,
      });
    }
  }

  private startHeartbeat(): void {
    // Update last_seen_at every 30 seconds
    this.heartbeatInterval = setInterval(async () => {
      if (this.displayId) {
        await this.supabase
          .from('displays')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', this.displayId);
      }
    }, 30000);
  }

  disconnect(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.displayId = null;
  }
}

export const realtimeService = new RealtimeService();
```

**Step 3: Verify types compile**

Run: `cd apps/host && pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/host/src/services/PairingService.ts apps/host/src/services/RealtimeService.ts
git commit -m "feat(host): add PairingService and RealtimeService for display management"
```

---

## Task 6: Host App - Add Dependencies

**Files:**
- Modify: `apps/host/package.json`

**Step 1: Add required dependencies**

Run: `cd apps/host && pnpm add react-native-qrcode-svg react-native-svg @react-native-async-storage/async-storage`

**Step 2: Verify installation**

Run: `pnpm install`
Expected: Installs without errors

**Step 3: Commit**

```bash
git add apps/host/package.json pnpm-lock.yaml
git commit -m "feat(host): add QR code and async storage dependencies"
```

---

## Task 7: Host App - PairingScreen Component

**Files:**
- Create: `apps/host/src/screens/PairingScreen.tsx`

**Step 1: Create PairingScreen**

```typescript
// apps/host/src/screens/PairingScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { pairingService } from '../services/PairingService';
import { realtimeService } from '../services/RealtimeService';

const { width, height } = Dimensions.get('window');

interface Props {
  onPaired: (displayId: string, name: string, churchId: string) => void;
}

export function PairingScreen({ onPaired }: Props) {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [displayId, setDisplayId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const generateCode = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await pairingService.generatePairingCode();
      setPairingCode(result.pairingCode);
      setDisplayId(result.displayId);
      setExpiresAt(new Date(result.expiresAt));
    } catch (err) {
      setError('Failed to generate pairing code. Please try again.');
      console.error('Pairing error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate initial code
  useEffect(() => {
    generateCode();
  }, [generateCode]);

  // Subscribe to realtime for pairing updates
  useEffect(() => {
    if (!displayId) return;

    realtimeService.connect(
      displayId,
      () => {}, // No commands during pairing
      async (name, churchId) => {
        // Display was claimed!
        await pairingService.savePairing(displayId);
        onPaired(displayId, name, churchId);
      }
    );

    return () => {
      realtimeService.disconnect();
    };
  }, [displayId, onPaired]);

  // Auto-refresh code when expired
  useEffect(() => {
    if (!expiresAt) return;

    const timeout = setTimeout(() => {
      generateCode();
    }, expiresAt.getTime() - Date.now());

    return () => clearTimeout(timeout);
  }, [expiresAt, generateCode]);

  const qrValue = pairingCode ? `mobileworship://pair?code=${pairingCode}` : '';

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Generating pairing code...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mobile Worship</Text>

      <View style={styles.qrContainer}>
        {pairingCode && (
          <QRCode
            value={qrValue}
            size={Math.min(width, height) * 0.3}
            backgroundColor="#000"
            color="#fff"
          />
        )}
      </View>

      <Text style={styles.codeLabel}>Or enter code:</Text>
      <Text style={styles.code}>{pairingCode}</Text>

      <Text style={styles.instructions}>
        Open the Mobile Worship app on your phone{'\n'}
        and scan this code or enter it manually
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 40,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#000',
    borderRadius: 16,
    marginBottom: 30,
  },
  codeLabel: {
    fontSize: 18,
    color: '#888',
    marginBottom: 8,
  },
  code: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 8,
    marginBottom: 40,
  },
  instructions: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  loadingText: {
    fontSize: 18,
    color: '#888',
    marginTop: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#f44',
    textAlign: 'center',
  },
});
```

**Step 2: Verify component compiles**

Run: `cd apps/host && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/host/src/screens/PairingScreen.tsx
git commit -m "feat(host): add PairingScreen with QR code and numeric code display"
```

---

## Task 8: Host App - ReadyScreen Component

**Files:**
- Create: `apps/host/src/screens/ReadyScreen.tsx`

**Step 1: Create ReadyScreen**

```typescript
// apps/host/src/screens/ReadyScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import type { DisplaySettings } from '@mobileworship/shared';

interface Props {
  displayName: string;
  churchName?: string;
  isConnected: boolean;
  defaultBackgroundUrl?: string;
  settings: DisplaySettings;
}

export function ReadyScreen({
  displayName,
  churchName,
  isConnected,
  defaultBackgroundUrl,
}: Props) {
  return (
    <View style={styles.container}>
      {defaultBackgroundUrl && (
        <Image
          source={{ uri: defaultBackgroundUrl }}
          style={styles.background}
          resizeMode="cover"
        />
      )}

      <View style={styles.overlay}>
        <View style={styles.statusIndicator}>
          <View style={[styles.dot, isConnected ? styles.dotConnected : styles.dotDisconnected]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Connected' : 'Reconnecting...'}
          </Text>
        </View>

        <Text style={styles.displayName}>{displayName}</Text>
        {churchName && <Text style={styles.churchName}>{churchName}</Text>}

        <Text style={styles.waitingText}>Waiting for event...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 40,
    right: 40,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  dotConnected: {
    backgroundColor: '#4f4',
  },
  dotDisconnected: {
    backgroundColor: '#f44',
  },
  statusText: {
    fontSize: 14,
    color: '#fff',
  },
  displayName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  churchName: {
    fontSize: 24,
    color: '#ccc',
    marginBottom: 40,
  },
  waitingText: {
    fontSize: 18,
    color: '#888',
  },
});
```

**Step 2: Commit**

```bash
git add apps/host/src/screens/ReadyScreen.tsx
git commit -m "feat(host): add ReadyScreen showing display name and connection status"
```

---

## Task 9: Host App - Update DisplayScreen

**Files:**
- Modify: `apps/host/src/screens/DisplayScreen.tsx`
- Modify: `apps/host/src/components/SlideRenderer.tsx`

**Step 1: Update SlideRenderer for new settings**

```typescript
// apps/host/src/components/SlideRenderer.tsx
import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import type { DisplaySettings } from '@mobileworship/shared';

const { width, height } = Dimensions.get('window');

interface Props {
  lines: string[];
  backgroundUrl?: string;
  backgroundType?: 'image' | 'video';
  settings: DisplaySettings;
}

const FONT_SIZES: Record<DisplaySettings['fontSize'], number> = {
  small: 32,
  medium: 48,
  large: 64,
  xlarge: 80,
};

export function SlideRenderer({ lines, backgroundUrl, settings }: Props) {
  const fontSize = FONT_SIZES[settings.fontSize];

  const textContainerStyle = {
    paddingTop: `${settings.margins.top}%`,
    paddingBottom: `${settings.margins.bottom}%`,
    paddingLeft: `${settings.margins.left}%`,
    paddingRight: `${settings.margins.right}%`,
    justifyContent: settings.textPosition === 'center'
      ? 'center'
      : settings.textPosition === 'bottom'
        ? 'flex-end'
        : 'flex-end', // lower-third handled by margins
  };

  const textStyle = {
    fontSize,
    fontFamily: settings.fontFamily === 'serif'
      ? 'Georgia'
      : settings.fontFamily === 'sans-serif'
        ? 'Helvetica'
        : undefined,
    textShadowColor: settings.textShadow ? 'rgba(0, 0, 0, 0.8)' : 'transparent',
    textShadowOffset: settings.textShadow ? { width: 2, height: 2 } : { width: 0, height: 0 },
    textShadowRadius: settings.textShadow ? 4 : 0,
  };

  return (
    <View style={styles.container}>
      {backgroundUrl && (
        <Image
          source={{ uri: backgroundUrl }}
          style={styles.background}
          resizeMode="cover"
        />
      )}

      {settings.overlayOpacity > 0 && (
        <View style={[styles.overlay, { opacity: settings.overlayOpacity }]} />
      )}

      <View style={[styles.textContainer, textContainerStyle]}>
        {lines.map((line, index) => (
          <Text key={index} style={[styles.line, textStyle]}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  textContainer: {
    flex: 1,
    alignItems: 'center',
  },
  line: {
    color: '#fff',
    textAlign: 'center',
    marginVertical: 4,
  },
});
```

**Step 2: Update DisplayScreen to use new architecture**

```typescript
// apps/host/src/screens/DisplayScreen.tsx
import React, { useState, useEffect, useCallback, useReducer } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import type { ClientCommand, HostState } from '@mobileworship/protocol';
import type { DisplaySettings } from '@mobileworship/shared';
import { DEFAULT_DISPLAY_SETTINGS } from '@mobileworship/shared';
import { SlideRenderer } from '../components/SlideRenderer';
import { pairingService } from '../services/PairingService';
import { realtimeService } from '../services/RealtimeService';
import { PairingScreen } from './PairingScreen';
import { ReadyScreen } from './ReadyScreen';

const { width, height } = Dimensions.get('window');

type AppState =
  | { screen: 'loading' }
  | { screen: 'pairing' }
  | { screen: 'ready'; displayId: string; name: string; churchId: string; settings: DisplaySettings }
  | { screen: 'display'; displayId: string; name: string; churchId: string; settings: DisplaySettings };

type Action =
  | { type: 'INIT_UNPAIRED' }
  | { type: 'INIT_PAIRED'; displayId: string; name: string; churchId: string; settings: DisplaySettings }
  | { type: 'PAIRED'; displayId: string; name: string; churchId: string }
  | { type: 'EVENT_LOADED' }
  | { type: 'EVENT_UNLOADED' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'INIT_UNPAIRED':
      return { screen: 'pairing' };
    case 'INIT_PAIRED':
      return {
        screen: 'ready',
        displayId: action.displayId,
        name: action.name,
        churchId: action.churchId,
        settings: action.settings,
      };
    case 'PAIRED':
      return {
        screen: 'ready',
        displayId: action.displayId,
        name: action.name,
        churchId: action.churchId,
        settings: DEFAULT_DISPLAY_SETTINGS,
      };
    case 'EVENT_LOADED':
      if (state.screen === 'ready') {
        return { ...state, screen: 'display' };
      }
      return state;
    case 'EVENT_UNLOADED':
      if (state.screen === 'display') {
        return { ...state, screen: 'ready' };
      }
      return state;
    default:
      return state;
  }
}

interface SlideContent {
  lines: string[];
  backgroundUrl?: string;
}

export function DisplayScreen() {
  const [appState, dispatch] = useReducer(reducer, { screen: 'loading' });
  const [hostState, setHostState] = useState<HostState>({
    displayId: '',
    eventId: null,
    currentItemIndex: 0,
    currentSectionIndex: 0,
    currentSlideIndex: 0,
    isBlank: false,
    isLogo: true,
    transition: 'fade',
    connectedClients: 0,
    lastUpdated: Date.now(),
  });
  const [currentSlide, setCurrentSlide] = useState<SlideContent | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize pairing on mount
  useEffect(() => {
    async function init() {
      const result = await pairingService.initialize();
      if (result.paired && result.displayId) {
        dispatch({
          type: 'INIT_PAIRED',
          displayId: result.displayId,
          name: result.name || 'Display',
          churchId: result.churchId || '',
          settings: result.settings || DEFAULT_DISPLAY_SETTINGS,
        });
      } else {
        dispatch({ type: 'INIT_UNPAIRED' });
      }
    }
    init();
  }, []);

  // Connect to realtime when ready
  useEffect(() => {
    if (appState.screen !== 'ready' && appState.screen !== 'display') return;

    realtimeService.connect(
      appState.displayId,
      handleCommand
    );
    setIsConnected(true);

    return () => {
      realtimeService.disconnect();
      setIsConnected(false);
    };
  }, [appState.screen === 'ready' || appState.screen === 'display' ? appState.displayId : null]);

  // Broadcast state changes
  useEffect(() => {
    if (isConnected) {
      realtimeService.broadcastState(hostState);
    }
  }, [hostState, isConnected]);

  const handleCommand = useCallback((command: ClientCommand) => {
    switch (command.type) {
      case 'LOAD_EVENT':
        // TODO: Fetch and cache event data
        dispatch({ type: 'EVENT_LOADED' });
        setHostState(s => ({ ...s, eventId: command.eventId, isLogo: false }));
        break;
      case 'UNLOAD_EVENT':
        dispatch({ type: 'EVENT_UNLOADED' });
        setHostState(s => ({ ...s, eventId: null, isLogo: true }));
        setCurrentSlide(null);
        break;
      case 'BLANK_SCREEN':
        setHostState(s => ({ ...s, isBlank: true, isLogo: false }));
        break;
      case 'SHOW_LOGO':
        setHostState(s => ({ ...s, isLogo: true, isBlank: false }));
        break;
      case 'UNBLANK':
        setHostState(s => ({ ...s, isBlank: false, isLogo: false }));
        break;
      case 'GOTO_SLIDE':
        setHostState(s => ({
          ...s,
          currentSlideIndex: command.slideIndex,
          isBlank: false,
          isLogo: false,
          lastUpdated: Date.now(),
        }));
        // TODO: Update currentSlide from cached data
        break;
      case 'NEXT_SLIDE':
        setHostState(s => ({
          ...s,
          currentSlideIndex: s.currentSlideIndex + 1,
          lastUpdated: Date.now(),
        }));
        break;
      case 'PREV_SLIDE':
        setHostState(s => ({
          ...s,
          currentSlideIndex: Math.max(0, s.currentSlideIndex - 1),
          lastUpdated: Date.now(),
        }));
        break;
      case 'SET_TRANSITION':
        setHostState(s => ({ ...s, transition: command.transition }));
        break;
    }
  }, []);

  const handlePaired = useCallback((displayId: string, name: string, churchId: string) => {
    dispatch({ type: 'PAIRED', displayId, name, churchId });
  }, []);

  // Render based on app state
  if (appState.screen === 'loading') {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (appState.screen === 'pairing') {
    return <PairingScreen onPaired={handlePaired} />;
  }

  if (appState.screen === 'ready') {
    return (
      <ReadyScreen
        displayName={appState.name}
        isConnected={isConnected}
        settings={appState.settings}
      />
    );
  }

  // Display screen
  if (hostState.isBlank) {
    return <View style={styles.container} />;
  }

  if (hostState.isLogo) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.logo}>Mobile Worship</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {currentSlide ? (
        <SlideRenderer
          lines={currentSlide.lines}
          backgroundUrl={currentSlide.backgroundUrl}
          settings={appState.settings}
        />
      ) : (
        <View style={[styles.container, styles.centered]}>
          <Text style={styles.subtitle}>No slide selected</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    width,
    height,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
  },
  loadingText: {
    fontSize: 18,
    color: '#888',
  },
});
```

**Step 3: Verify everything compiles**

Run: `cd apps/host && pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/host/src/screens/DisplayScreen.tsx apps/host/src/components/SlideRenderer.tsx
git commit -m "feat(host): integrate pairing flow and settings-aware slide rendering"
```

---

## Task 10: Android TV Configuration

**Files:**
- Modify: `apps/host/android/app/src/main/AndroidManifest.xml`
- Create: `apps/host/android/app/src/main/res/drawable/tv_banner.png` (placeholder)

**Step 1: Read current AndroidManifest.xml**

Read the file to understand current structure.

**Step 2: Add TV support to AndroidManifest.xml**

Add the following to `<manifest>`:
```xml
<!-- TV Support -->
<uses-feature android:name="android.software.leanback" android:required="false" />
<uses-feature android:name="android.hardware.touchscreen" android:required="false" />
```

Add to `<application>`:
```xml
android:banner="@drawable/tv_banner"
```

Add to `<activity android:name=".MainActivity">`:
```xml
<intent-filter>
    <action android:name="android.intent.action.MAIN" />
    <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
</intent-filter>
```

**Step 3: Create placeholder TV banner**

Create a 320x180 PNG placeholder at:
`apps/host/android/app/src/main/res/drawable/tv_banner.png`

**Step 4: Commit**

```bash
git add apps/host/android/app/src/main/AndroidManifest.xml apps/host/android/app/src/main/res/drawable/tv_banner.png
git commit -m "feat(host): add Android TV launcher support"
```

---

## Task 11: Keep Screen On

**Files:**
- Modify: `apps/host/App.tsx`

**Step 1: Add keep-awake dependency**

Run: `cd apps/host && pnpm add react-native-keep-awake`

**Step 2: Update App.tsx to keep screen on**

Add to App.tsx:
```typescript
import KeepAwake from 'react-native-keep-awake';

// Inside App component, after providers:
<KeepAwake />
```

**Step 3: Commit**

```bash
git add apps/host/App.tsx apps/host/package.json pnpm-lock.yaml
git commit -m "feat(host): keep screen awake during display mode"
```

---

## Task 12: Integration Test

**Files:** None (manual testing)

**Step 1: Start the host app on Android TV emulator**

Run: `cd apps/host && pnpm android`

**Step 2: Verify pairing flow**

1. App should show pairing screen with QR code and 6-digit code
2. Code should refresh after 10 minutes

**Step 3: Test via Supabase dashboard**

1. In Supabase dashboard, manually update the display record:
   - Set `church_id` to a valid church
   - Set `paired_at` to current timestamp
   - Set `name` to "Test Display"

2. Host app should transition to Ready screen

**Step 4: Document any issues**

Note any bugs or improvements needed.

---

## Task 13: Final Cleanup and Documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update CLAUDE.md with host app details**

Add section about host app:
```markdown
### Host App (Display)
- Supports Android TV, Windows, macOS
- Pairing flow: QR code + 6-digit numeric code
- Communication via Supabase Realtime
- Display settings configurable per-display
```

**Step 2: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with host app documentation"
```

**Step 3: Verify all tests pass**

Run: `pnpm test`
Expected: All tests pass

---

## Summary

**Tasks completed:**
1. Database migration for displays table
2. Shared types for display settings
3. Protocol updates for new commands
4. Edge function for pairing
5. PairingService and RealtimeService
6. Host app dependencies
7. PairingScreen component
8. ReadyScreen component
9. Updated DisplayScreen with full flow
10. Android TV configuration
11. Keep screen awake
12. Integration testing
13. Documentation

**Next steps after this plan:**
- Web app: Add Displays management page
- Client app: Add "Add Display" flow with code entry
- Full event loading and caching implementation
