# Client Display Pairing Design

**Date:** 2024-12-24
**Status:** Approved

## Overview

Add display pairing functionality to the client (controller) app, allowing users to connect to host displays by scanning a QR code or entering a 6-digit numeric code.

## Background

The host app already displays a QR code and 6-digit pairing code. The edge function `display-pairing` has a `claim` action ready to be called. The client app currently has no way to trigger pairing.

## Navigation Structure

Add a 4th tab to the `MainTabNavigator`:

```
Songs | Events | Displays | Settings
```

The Displays tab uses a stack navigator:

```
DisplaysList (tab root)
├── [+ Add Display] → AddDisplay
│     ├── QR Scanner (default view)
│     ├── [Enter manually] → Manual code input
│     └── [Success] → NameDisplay → back to DisplaysList
│
└── [Tap display row] → DisplayDetail
      ├── Edit name/location
      ├── Display settings
      ├── Test connection
      └── Remove display
```

**Tab Icon:** TV/monitor icon

## Screen Designs

### DisplaysList Screen

List view showing all paired displays for the church:

```
┌─────────────────────────────────────────────┐
│ 🟢 Main Sanctuary                        >  │
│    Last seen: just now                      │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ 🔴 Youth Room                            >  │
│    Last seen: 3 days ago                    │
└─────────────────────────────────────────────┘
```

- **Status dot:** Green = online (seen in last 60s), Red = offline
- **Primary text:** Display name
- **Secondary text:** Relative timestamp
- **Header:** "Displays" title with "+" button
- **Empty state:** "No displays paired yet" with "Add Display" button
- **Swipe left:** Red "Remove" button with confirmation
- **Pull-to-refresh:** Re-fetches display list

### AddDisplay Screen

**Default: QR Scanner**

Full-screen camera with:
- Viewfinder overlay (rounded square)
- Header: "Scan Display Code" with back button
- Footer: "Enter code manually" text button

QR format: `mobileworship://pair?code=123456`

**Manual Entry (via footer link):**

```
┌─────────────────────────────────────────────┐
│  ←  Enter Display Code                      │
├─────────────────────────────────────────────┤
│                                             │
│         Enter the 6-digit code              │
│         shown on your display               │
│                                             │
│          ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐          │
│          │ │ │ │ │ │ │ │ │ │ │ │          │
│          └─┘ └─┘ └─┘ └─┘ └─┘ └─┘          │
│                                             │
│          [ Connect Display ]                │
│                                             │
└─────────────────────────────────────────────┘
```

- 6 individual digit inputs with auto-advance
- Numeric keyboard only
- Button disabled until 6 digits entered

**Error Messages:**
- Invalid/expired: "Code not found or expired. Check the display and try again."
- Network error: "Connection failed. Please check your internet."

### NameDisplay Screen

After successful code validation:

```
┌─────────────────────────────────────────────┐
│  ←  Name This Display                       │
├─────────────────────────────────────────────┤
│                                             │
│         ✓ Display found!                    │
│         Android TV • 1920×1080              │
│                                             │
│    Name                                     │
│    ┌─────────────────────────────────────┐ │
│    │ Main Sanctuary                      │ │
│    └─────────────────────────────────────┘ │
│                                             │
│    Location (optional)                      │
│    ┌─────────────────────────────────────┐ │
│    │ Building A                          │ │
│    └─────────────────────────────────────┘ │
│                                             │
│         [ Complete Setup ]                  │
│                                             │
└─────────────────────────────────────────────┘
```

- **Name:** Required, placeholder "e.g., Main Sanctuary"
- **Location:** Optional, placeholder "e.g., Building A"
- **Device info:** Shows platform and resolution from `device_info`
- **On submit:** Calls `claim` action, navigates to list, shows toast

### DisplayDetail Screen

```
┌─────────────────────────────────────────────┐
│  ←  Main Sanctuary                    Edit  │
├─────────────────────────────────────────────┤
│                                             │
│  Status        🟢 Online                    │
│  Device        Android TV • 1920×1080       │
│  Last seen     Just now                     │
│                                             │
├─────────────────────────────────────────────┤
│  DISPLAY SETTINGS                           │
├─────────────────────────────────────────────┤
│  Font Size                        Large  >  │
│  Text Position                   Center  >  │
│  Font Family                     System  >  │
│  Text Shadow                          ON 🔘 │
│  Overlay Opacity                      70%   │
│  Margins                           Edit  >  │
├─────────────────────────────────────────────┤
│                                             │
│  [ Test Connection ]                        │
│                                             │
│  [ Remove Display ]     ← Red text          │
│                                             │
└─────────────────────────────────────────────┘
```

- **Edit button:** Modal to edit name/location
- **Settings:** Each row opens picker, saves immediately to DB
- **Test Connection:** Pings display via Realtime, shows result toast
- **Remove Display:** Confirmation → clears pairing, navigates to list

## Data Layer

### New Hooks

**`useDisplays()` in `packages/shared/src/hooks/`**

```typescript
interface UseDisplaysResult {
  displays: Display[]
  isLoading: boolean
  refetch: () => void
}
```

- Queries `displays` table filtered by `church_id`
- Subscribes to Realtime for `last_seen_at` updates
- Calculates `isOnline` from `last_seen_at` (< 60 seconds ago)

**`useDisplay(displayId)` in `packages/shared/src/hooks/`**

```typescript
interface UseDisplayResult {
  display: Display | null
  updateSettings: (settings: Partial<DisplaySettings>) => Promise<void>
  updateName: (name: string, location?: string) => Promise<void>
  remove: () => Promise<void>
  testConnection: () => Promise<boolean>
}
```

### New Service

**`displayPairing.ts` in `packages/shared/src/services/`**

```typescript
async function claimDisplay(
  code: string,
  name: string,
  location?: string
): Promise<Display>
```

Calls edge function with `action: 'claim'`.

### Settings Sync

When client updates settings in DB, host receives changes via existing Postgres changes subscription and applies immediately. Settings can be edited while display is offline and will sync on reconnect.

## Deep Link Handling

**URL Scheme:** `mobileworship://pair?code=123456`

**Configuration:**
- iOS: Add `mobileworship` to URL schemes in `Info.plist`
- Android: Add intent filter in `AndroidManifest.xml`

**Flow:**
1. Parse URL for `code` parameter
2. If authenticated → Navigate to NameDisplay with code
3. If not authenticated → Store code, show login, redirect after auth

**Edge Cases:**
- Expired code: Show error with "Scan Again" button
- Already claimed: "This display is already paired to another church"
- Malformed URL: Ignore, open app to default screen

## Theming & i18n

**Dark Mode:** All screens use Tailwind `dark:` variants per project conventions.

**Translations:** Add keys to `en.json` and `es.json`:
- `displays.title`, `displays.addDisplay`, `displays.empty`
- `displays.scanCode`, `displays.enterManually`, `displays.nameDisplay`
- `displays.lastSeen`, `displays.online`, `displays.offline`
- `displays.settings.*`, `displays.remove`, `displays.testConnection`

## New Files

```
apps/client/src/
├── navigation/
│   └── DisplaysNavigator.tsx      # Stack navigator for displays
├── screens/displays/
│   ├── DisplaysListScreen.tsx     # List with add button
│   ├── AddDisplayScreen.tsx       # QR scanner + manual entry
│   ├── NameDisplayScreen.tsx      # Name/location form
│   └── DisplayDetailScreen.tsx    # Settings & management

packages/shared/src/
├── hooks/
│   ├── useDisplays.ts
│   └── useDisplay.ts
├── services/
│   └── displayPairing.ts
```

## Dependencies

Add to `apps/client/package.json`:
- `react-native-vision-camera` - Camera access for QR scanning
- `react-native-worklets-core` - Required by vision-camera
