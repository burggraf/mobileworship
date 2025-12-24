# Android TV Display App - Design Document

## Overview

Extend the existing `apps/host/` React Native app to support Android TV as a display target. The host app is intentionally minimal: display a pairing code, get claimed by a client, cache event data, and render slides via remote control.

## Architecture Decision

**Approach:** Extend existing host app (not separate TV app)

**Rationale:**
- Minimal UI means no TV-specific concerns (D-pad nav, focus management, 10-foot UI)
- Identical core logic across all platforms (Windows, macOS, Android TV, future tvOS)
- Single codebase to maintain

## Database Schema

New `displays` table:

```sql
CREATE TABLE displays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid REFERENCES churches NOT NULL,

  -- Identity
  name text NOT NULL,
  location text,

  -- Pairing
  pairing_code text,
  pairing_code_expires_at timestamptz,
  paired_at timestamptz,

  -- Status
  last_seen_at timestamptz,
  device_info jsonb,

  -- Settings
  default_background_id uuid REFERENCES media,
  settings jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: Users can only manage displays for their church
CREATE POLICY "tenant_isolation" ON displays
  USING (church_id = (SELECT church_id FROM users WHERE id = auth.uid()));

-- Index for pairing code lookups
CREATE INDEX idx_displays_pairing_code ON displays(pairing_code) WHERE pairing_code IS NOT NULL;
```

**Display settings schema:**

```typescript
interface DisplaySettings {
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  textPosition: 'center' | 'bottom' | 'lower-third';
  margins: { top: number; bottom: number; left: number; right: number };
  fontFamily: 'system' | 'serif' | 'sans-serif';
  textShadow: boolean;
  overlayOpacity: number; // 0-1
}
```

## Pairing Flow

### Code Generation

1. Host app launches, checks local storage for existing `display_id`
2. If not found or invalid, calls edge function to generate pairing code
3. Displays QR code + 6-digit numeric code
4. Code expires after 10 minutes

### Edge Function: `display-pairing`

**Generate action:**
```
POST /functions/v1/display-pairing
{ action: 'generate', deviceInfo: { platform, version, resolution } }

Response:
{ display_id: 'uuid', pairing_code: '847291' }
```

**Claim action:**
```
POST /functions/v1/display-pairing
{ action: 'claim', code: '847291', name: 'Main Sanctuary', location: 'Building A' }

Response:
{ display_id: 'uuid', name: 'Main Sanctuary' }
```

### Host Receives Claim

- Host subscribes to Supabase Realtime: `displays:id=eq.{display_id}`
- On update with `paired_at` set:
  - Save `display_id` to local storage
  - Transition to ReadyScreen

## Host App Screens

### 1. PairingScreen

- Large QR code encoding `mobileworship://pair?code=847291`
- Numeric code below: "Or enter code: 847291"
- Status: "Waiting to be claimed..."
- Auto-refreshes code when expired

### 2. ReadyScreen

- Display name: "Main Sanctuary"
- Church name
- Connection status indicator
- "Waiting for event..."
- Default background if configured

### 3. DisplayScreen

- Full-screen slide rendering
- Rendering layers (bottom to top):
  1. Background (image/video/solid)
  2. Overlay (optional dark gradient)
  3. Text (lyrics/scripture with shadow)

## Slide Types

1. **Lyrics** - Text lines over background
2. **Scripture** - Similar styling, different defaults
3. **Title** - Song title/author at start of songs
4. **Blank** - Background only or solid black
5. **Logo** - Church logo, default idle state

## Communication

### Primary: Supabase Realtime

Channel: `display:{display_id}`

**Client → Host (broadcast: command):**
```typescript
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
| { type: 'UPDATE_SETTINGS'; settings: DisplaySettings }
```

**Host → Client (broadcast: state):**
```typescript
{
  displayId: string;
  eventId: string | null;
  currentItemIndex: number;
  currentSlideIndex: number;
  isBlank: boolean;
  isLogo: boolean;
  transition: TransitionType;
  lastUpdated: number;
}
```

**Host → Client (broadcast: status):**
```typescript
| { type: 'EVENT_READY'; eventId: string }
| { type: 'EVENT_LOADING'; progress: number }
| { type: 'EVENT_ERROR'; message: string }
| { type: 'DISPLAY_INFO'; info: DisplayInfo }
```

### Heartbeat

- Host updates `last_seen_at` every 30 seconds
- Client dashboard shows online/offline status

## Data Caching

When client sends `LOAD_EVENT`:

1. Host fetches event data from Supabase (songs, arrangements, backgrounds)
2. Downloads all media to local file system
3. Stores metadata in SQLite
4. Sends `EVENT_READY` when complete

**Cached data:**
- SQLite: Event metadata, songs, slide content
- File system: Background images/videos

## Android TV Configuration

### AndroidManifest.xml Updates

```xml
<uses-feature android:name="android.software.leanback" android:required="false" />
<uses-feature android:name="android.hardware.touchscreen" android:required="false" />

<application android:banner="@drawable/tv_banner">
  <activity android:name=".MainActivity">
    <intent-filter>
      <action android:name="android.intent.action.MAIN" />
      <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
    </intent-filter>
  </activity>
</application>
```

### Required Assets

- TV banner: `tv_banner.png` (320x180px)

### TV-Specific Behavior

- Wake lock to prevent screen timeout during events
- Handle app background/foreground gracefully
- No Leanback UI library needed (minimal UI)

## Transitions

- `cut` - Instant switch
- `fade` - Cross-fade, 300ms (default)
- `slide` - Slide left/right

## Implementation Scope

### Included

- Database migration for `displays` table
- Edge function for pairing
- Host app screens (Pairing, Ready, Display)
- Supabase Realtime communication
- Data caching (SQLite + file system)
- Android TV manifest and assets
- Protocol updates

### Deferred

- tvOS support (same pattern, add later)
- Local WebSocket as primary (Realtime sufficient for MVP)
- Complex transition animations
- Video backgrounds (images first)
