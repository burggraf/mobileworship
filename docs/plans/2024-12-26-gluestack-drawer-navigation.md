# Gluestack UI + Drawer Navigation Design

**Date:** 2024-12-26
**Status:** Proposed

## Overview

Implement Gluestack UI across web, iOS, Android, macOS, and Windows apps with a unified left-side collapsible drawer navigation. TV apps (Android TV, Apple TV) remain separate as display-only interfaces.

## Goals

1. **Unified UI library** - Single component library works across all platforms
2. **Shared codebase** - ~90% UI code reuse between web and native
3. **Drawer navigation** - Replace tabs with collapsible left drawer
4. **Fresh design system** - Use Gluestack defaults with customizable brand colors
5. **Easy theming** - Centralized tokens for future brand adjustments

## Platform Scope

| Platform | UI Library | Navigation | In Scope |
|----------|-----------|------------|----------|
| Web | Gluestack UI | Drawer | Yes |
| iOS (client) | Gluestack UI | Drawer | Yes |
| Android (client) | Gluestack UI | Drawer | Yes |
| Windows (host) | Gluestack UI | Drawer | Yes |
| macOS (host) | Gluestack UI | Drawer | Yes |
| Android TV | Current | Display-only | No |
| Apple TV | Current | Display-only | No |

## Architecture

### Package Structure

```
packages/ui/
├── src/
│   ├── provider/
│   │   └── GluestackProvider.tsx    # Theme + config wrapper
│   ├── components/
│   │   ├── AppDrawer.tsx            # Main drawer navigation
│   │   ├── DrawerItem.tsx           # Individual nav item
│   │   ├── AppHeader.tsx            # Top bar with hamburger toggle
│   │   ├── Button.tsx               # Re-export with defaults
│   │   ├── Card.tsx                 # Content cards
│   │   ├── Input.tsx                # Form inputs
│   │   └── ...                      # Other shared components
│   ├── layouts/
│   │   └── AppLayout.tsx            # Drawer + header + content area
│   ├── hooks/
│   │   ├── useAppNavigation.ts      # Cross-platform navigation API
│   │   └── useDrawerState.ts        # Drawer open/collapsed state
│   ├── utils/
│   │   └── storage.ts               # Cross-platform storage abstraction
│   └── theme/
│       ├── index.ts                 # Theme configuration
│       └── tokens.ts                # Colors, spacing, typography
├── package.json
└── index.ts
```

### Dependencies

```json
{
  "@gluestack-ui/themed": "^1.x",
  "@gluestack-style/react": "^1.x",
  "lucide-react-native": "^0.x"
}
```

## Drawer Navigation

### Responsive Behavior

| Screen Size | Default State | User Control |
|-------------|---------------|--------------|
| Desktop (≥1024px) | Open (~250px) | Toggle to collapsed (~64px icons only) |
| Tablet (768-1023px) | Collapsed (icons only) | Toggle to full or overlay |
| Mobile (<768px) | Hidden | Hamburger opens overlay drawer |

### Drawer States

1. **Expanded** - Full width with icons + labels (~250px)
2. **Collapsed** - Icons only with tooltips on hover (~64px)
3. **Hidden** - Off-screen, overlay when opened (mobile)

### State Persistence

- User's collapse preference saved to `localStorage` (web) / `AsyncStorage` (native)
- Preference respected on return visits
- Mobile always starts hidden regardless of saved preference

### Navigation Items

```
┌─────────────────────┐
│  [Logo] Mobile      │  ← App branding
│        Worship      │
├─────────────────────┤
│  🎵  Songs          │
│  📅  Events         │
│  🖥️  Displays       │
│  🖼️  Media          │
├─────────────────────┤
│  ⚙️  Settings       │  ← Bottom-pinned
│  [User Avatar]      │  ← Current user, logout
└─────────────────────┘
```

### Animation

- Smooth width transition (200ms ease-out)
- Content area adjusts fluidly with drawer
- Mobile: slide-in overlay with backdrop blur

## Theme Configuration

### Token Structure

```typescript
// packages/ui/src/theme/tokens.ts

// ============================================
// BRAND COLORS - Edit these to change the app's look
// ============================================
export const brandColors = {
  // Primary - main brand color (default: indigo)
  primary50: '#f0f4ff',
  primary100: '#e0e7ff',
  primary200: '#c7d2fe',
  primary300: '#a5b4fc',
  primary400: '#818cf8',
  primary500: '#6366f1',  // Main brand color
  primary600: '#4f46e5',  // Hover/active states
  primary700: '#4338ca',
  primary800: '#3730a3',
  primary900: '#312e81',
};

// All other colors use Gluestack defaults
// (gray, red, green, yellow, etc.)
```

### Dark Mode

- Built-in via Gluestack's `colorMode` prop
- Detects system preference automatically
- User override stored in localStorage/AsyncStorage
- Components adapt automatically—no manual dark classes

### Typography

- System font stack (Gluestack defaults)
- Consistent sizing scale across platforms
- Optimized line heights for lyrics readability

## App Integration

### Web App

```typescript
// apps/web/src/App.tsx
import { GluestackProvider, AppLayout } from '@mobileworship/ui';

function App() {
  return (
    <GluestackProvider>
      <QueryClientProvider client={queryClient}>
        <SupabaseProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                {/* Public routes - no drawer */}
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />

                {/* Dashboard routes - with drawer */}
                <Route path="/dashboard/*" element={
                  <AppLayout>
                    <DashboardRoutes />
                  </AppLayout>
                } />

                {/* Fullscreen routes - no drawer */}
                <Route path="/control/:eventId" element={<ControlPage />} />
                <Route path="/present/:eventId" element={<PresentationPage />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </SupabaseProvider>
      </QueryClientProvider>
    </GluestackProvider>
  );
}
```

### Client App (iOS/Android)

```typescript
// apps/client/App.tsx
import { GluestackProvider, DrawerContent } from '@mobileworship/ui';
import { createDrawerNavigator } from '@react-navigation/drawer';

const Drawer = createDrawerNavigator();

function AuthenticatedApp() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        drawerType: 'slide',
        headerShown: false,
      }}
    >
      <Drawer.Screen name="Songs" component={SongsScreen} />
      <Drawer.Screen name="Events" component={EventsScreen} />
      <Drawer.Screen name="Displays" component={DisplaysNavigator} />
      <Drawer.Screen name="Media" component={MediaScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
    </Drawer.Navigator>
  );
}

function App() {
  return (
    <GluestackProvider>
      <QueryClientProvider client={queryClient}>
        <SupabaseProvider>
          <AuthProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </AuthProvider>
        </SupabaseProvider>
      </QueryClientProvider>
    </GluestackProvider>
  );
}
```

### Host App (Windows/macOS)

Same pattern as client app, with host-specific screens for display management and pairing.

## Code Sharing Strategy

### Shared (~90%)

| Component | Location |
|-----------|----------|
| All Gluestack components | `packages/ui/src/components/` |
| DrawerContent | `packages/ui/src/components/AppDrawer.tsx` |
| AppHeader | `packages/ui/src/components/AppHeader.tsx` |
| Theme tokens | `packages/ui/src/theme/tokens.ts` |
| Icons (Lucide) | `lucide-react-native` |
| Storage abstraction | `packages/ui/src/utils/storage.ts` |
| Navigation hook | `packages/ui/src/hooks/useAppNavigation.ts` |

### Platform-Specific (~10%)

| Concern | Web | Native |
|---------|-----|--------|
| Navigation container | `<BrowserRouter>` | `<NavigationContainer>` |
| Drawer shell | CSS-based panel | `@react-navigation/drawer` |
| Route definitions | `<Routes>` | `<Drawer.Navigator>` |
| URL handling | Browser URLs | Deep linking |
| Storage backend | `localStorage` | `AsyncStorage` |

### Abstraction Utilities

```typescript
// packages/ui/src/utils/storage.ts
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  get: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return AsyncStorage.getItem(key);
  },

  set: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },

  remove: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};
```

```typescript
// packages/ui/src/hooks/useAppNavigation.ts
// Provides consistent API across platforms:
// - navigate('Songs')
// - goBack()
// - getCurrentRoute()
```

## Migration Plan

### Phase 1: Setup Gluestack in packages/ui

1. Add Gluestack dependencies to `packages/ui/package.json`
2. Create theme configuration with brand tokens
3. Build `GluestackProvider` wrapper
4. Create core shared components (Button, Card, Input, Text, etc.)
5. Build `DrawerContent` component
6. Build `AppHeader` component
7. Build `AppLayout` wrapper
8. Create storage and navigation abstractions

**No app changes yet—existing code keeps working.**

### Phase 2: Web App Migration

1. Add `packages/ui` dependency (already exists)
2. Wrap `App.tsx` in `GluestackProvider`
3. Replace `DashboardLayout` with drawer-based `AppLayout`
4. Migrate pages one-by-one to Gluestack components
5. Coexist with Tailwind during migration
6. Remove Tailwind classes as pages complete

### Phase 3: Client App Migration

1. Add `@react-navigation/drawer` dependency
2. Update `RootNavigator` to use drawer instead of bottom tabs
3. Integrate `DrawerContent` from `packages/ui`
4. Migrate screens to use shared Gluestack components
5. Remove NativeWind as screens migrate

### Phase 4: Host App Migration (Desktop Only)

1. Same pattern as client app
2. Only affects Windows/macOS builds
3. TV builds remain completely unchanged

### Phase 5: Cleanup

1. Remove unused Tailwind config from web
2. Remove unused NativeWind config from native apps
3. Remove old tab navigation components
4. Update any changed i18n keys
5. Comprehensive cross-platform testing

## Testing Plan

### Per-Platform Verification

| Platform | Command | Test Environment |
|----------|---------|------------------|
| Web | `pnpm dev:web` | Chrome, Firefox, Safari |
| iOS | `pnpm dev:client` | iOS Simulator |
| Android | `pnpm dev:client` | Android Emulator |
| macOS | `pnpm dev:host` | macOS native |
| Windows | `pnpm dev:host` | Windows native |

### Key Behaviors to Verify

1. **Drawer toggle** - Opens/closes correctly on all platforms
2. **Responsive breakpoints** - Correct default state per screen size
3. **State persistence** - Collapse preference remembered across sessions
4. **Dark mode** - Toggle works, all components adapt properly
5. **Navigation** - All routes accessible via drawer items
6. **Active state** - Current route highlighted in drawer
7. **Existing functionality** - Songs, Events, Displays, Media, Settings all work

### Accessibility

- Drawer closes with Escape key (web)
- Proper focus management when drawer opens/closes
- Screen reader announces drawer state changes
- Touch targets meet minimum size (44px)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Gluestack bundle size | Tree-shaking, only import used components |
| Learning curve | Gluestack API is similar to other component libraries |
| Migration disruption | Phased approach, coexistence during transition |
| Platform-specific bugs | Test on all platforms each phase |
| Performance regression | Profile before/after, optimize as needed |

## Success Criteria

- [ ] Single `packages/ui` works on web, iOS, Android, macOS, Windows
- [ ] Drawer navigation functional on all platforms
- [ ] ~90% code reuse for UI components
- [ ] Dark mode works everywhere
- [ ] Brand colors easily changeable in one file
- [ ] No regression in existing functionality
- [ ] TV apps unaffected
