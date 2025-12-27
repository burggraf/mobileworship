# Gluestack UI + Drawer Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace tabs with a collapsible drawer navigation using Gluestack UI across web, iOS, Android, Windows, and macOS apps.

**Architecture:** Shared `packages/ui` contains all Gluestack components including drawer. Web uses CSS-based drawer, native apps use `@react-navigation/drawer`. Theme tokens centralized for easy brand customization.

**Tech Stack:** Gluestack UI v1, React Navigation Drawer, Lucide icons, AsyncStorage/localStorage for persistence.

---

## Phase 1: Setup Gluestack in packages/ui

### Task 1.1: Add Gluestack dependencies to packages/ui

**Files:**
- Modify: `packages/ui/package.json`

**Step 1: Update package.json with Gluestack dependencies**

```json
{
  "name": "@mobileworship/ui",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./provider": "./src/provider/index.ts",
    "./theme": "./src/theme/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@mobileworship/shared": "workspace:*",
    "@gluestack-ui/themed": "^1.1.0",
    "@gluestack-style/react": "^1.0.0",
    "lucide-react-native": "^0.460.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "typescript": "^5.4.0"
  },
  "peerDependencies": {
    "react": "^18.2.0",
    "react-native": ">=0.73.0",
    "react-native-svg": ">=13.0.0"
  },
  "peerDependenciesMeta": {
    "react-native": {
      "optional": true
    },
    "react-native-svg": {
      "optional": true
    }
  }
}
```

**Step 2: Install dependencies**

Run: `cd /Users/markb/dev/mobileworship/.worktrees/gluestack-drawer && pnpm install`
Expected: Dependencies installed successfully

**Step 3: Commit**

```bash
git add packages/ui/package.json pnpm-lock.yaml
git commit -m "feat(ui): add Gluestack UI dependencies"
```

---

### Task 1.2: Create theme tokens

**Files:**
- Create: `packages/ui/src/theme/tokens.ts`
- Create: `packages/ui/src/theme/index.ts`

**Step 1: Create tokens.ts with brand colors**

```typescript
// packages/ui/src/theme/tokens.ts

/**
 * Brand Color Configuration
 * ========================
 * Edit these values to change the app's primary color scheme.
 * All Gluestack components will automatically use these colors.
 */
export const brandColors = {
  // Primary - Indigo (spiritual, calming)
  primary0: '#ffffff',
  primary50: '#eef2ff',
  primary100: '#e0e7ff',
  primary200: '#c7d2fe',
  primary300: '#a5b4fc',
  primary400: '#818cf8',
  primary500: '#6366f1', // Main brand color
  primary600: '#4f46e5', // Hover/pressed states
  primary700: '#4338ca',
  primary800: '#3730a3',
  primary900: '#312e81',
  primary950: '#1e1b4b',
};

/**
 * Drawer Configuration
 * ====================
 * Customize drawer dimensions and breakpoints.
 */
export const drawerConfig = {
  // Width when expanded
  expandedWidth: 256,
  // Width when collapsed (icons only)
  collapsedWidth: 72,
  // Breakpoints for responsive behavior
  breakpoints: {
    // Below this: drawer hidden, hamburger menu
    mobile: 768,
    // Below this: drawer collapsed by default
    tablet: 1024,
  },
  // Animation duration in ms
  animationDuration: 200,
};

/**
 * Storage Keys
 * ============
 * Keys used for persisting user preferences.
 */
export const storageKeys = {
  drawerCollapsed: 'mobileworship:drawer:collapsed',
  colorMode: 'mobileworship:colorMode',
};
```

**Step 2: Create theme/index.ts**

```typescript
// packages/ui/src/theme/index.ts

import { createConfig } from '@gluestack-style/react';
import { brandColors, drawerConfig, storageKeys } from './tokens';

export const gluestackConfig = createConfig({
  aliases: {
    bg: 'backgroundColor',
    bgColor: 'backgroundColor',
    rounded: 'borderRadius',
    h: 'height',
    w: 'width',
    p: 'padding',
    px: 'paddingHorizontal',
    py: 'paddingVertical',
    m: 'margin',
    mx: 'marginHorizontal',
    my: 'marginVertical',
  },
  tokens: {
    colors: {
      // Brand colors
      ...Object.fromEntries(
        Object.entries(brandColors).map(([key, value]) => [`primary${key.replace('primary', '')}`, value])
      ),
      // Keep defaults for other semantic colors (error, success, warning, info)
    },
    space: {
      'px': 1,
      '0': 0,
      '0.5': 2,
      '1': 4,
      '1.5': 6,
      '2': 8,
      '2.5': 10,
      '3': 12,
      '3.5': 14,
      '4': 16,
      '5': 20,
      '6': 24,
      '7': 28,
      '8': 32,
      '9': 36,
      '10': 40,
      '12': 48,
      '16': 64,
      '20': 80,
      '24': 96,
      '32': 128,
    },
    radii: {
      'none': 0,
      'xs': 2,
      'sm': 4,
      'md': 6,
      'lg': 8,
      'xl': 12,
      '2xl': 16,
      '3xl': 24,
      'full': 9999,
    },
  },
});

export { brandColors, drawerConfig, storageKeys };
export type GluestackConfig = typeof gluestackConfig;
```

**Step 3: Commit**

```bash
git add packages/ui/src/theme/
git commit -m "feat(ui): add theme tokens and Gluestack config"
```

---

### Task 1.3: Create storage utility

**Files:**
- Create: `packages/ui/src/utils/storage.ts`
- Create: `packages/ui/src/utils/index.ts`

**Step 1: Create cross-platform storage utility**

```typescript
// packages/ui/src/utils/storage.ts

import { Platform } from 'react-native';

// Lazy import AsyncStorage only on native
let AsyncStorage: typeof import('@react-native-async-storage/async-storage').default | null = null;

const getAsyncStorage = async () => {
  if (Platform.OS !== 'web' && !AsyncStorage) {
    const module = await import('@react-native-async-storage/async-storage');
    AsyncStorage = module.default;
  }
  return AsyncStorage;
};

export const storage = {
  get: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    const store = await getAsyncStorage();
    return store?.getItem(key) ?? null;
  },

  set: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch {
        // localStorage not available (SSR, private browsing)
      }
      return;
    }
    const store = await getAsyncStorage();
    await store?.setItem(key, value);
  },

  remove: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
      } catch {
        // localStorage not available
      }
      return;
    }
    const store = await getAsyncStorage();
    await store?.removeItem(key);
  },
};
```

**Step 2: Create utils/index.ts**

```typescript
// packages/ui/src/utils/index.ts

export { storage } from './storage';
```

**Step 3: Commit**

```bash
git add packages/ui/src/utils/
git commit -m "feat(ui): add cross-platform storage utility"
```

---

### Task 1.4: Create GluestackProvider

**Files:**
- Create: `packages/ui/src/provider/GluestackProvider.tsx`
- Create: `packages/ui/src/provider/index.ts`

**Step 1: Create the provider component**

```typescript
// packages/ui/src/provider/GluestackProvider.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { gluestackConfig, storageKeys } from '../theme';
import { storage } from '../utils/storage';

type ColorMode = 'light' | 'dark';

interface GluestackContextValue {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
}

const GluestackContext = createContext<GluestackContextValue | null>(null);

export function useColorMode() {
  const context = useContext(GluestackContext);
  if (!context) {
    throw new Error('useColorMode must be used within GluestackProvider');
  }
  return context;
}

interface GluestackProviderProps {
  children: ReactNode;
}

export function GluestackProvider({ children }: GluestackProviderProps) {
  const systemColorScheme = useColorScheme();
  const [colorMode, setColorModeState] = useState<ColorMode>(systemColorScheme ?? 'light');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    const loadColorMode = async () => {
      const saved = await storage.get(storageKeys.colorMode);
      if (saved === 'light' || saved === 'dark') {
        setColorModeState(saved);
      }
      setIsLoaded(true);
    };
    loadColorMode();
  }, []);

  const setColorMode = async (mode: ColorMode) => {
    setColorModeState(mode);
    await storage.set(storageKeys.colorMode, mode);
  };

  const toggleColorMode = () => {
    setColorMode(colorMode === 'light' ? 'dark' : 'light');
  };

  // Don't render until we've loaded the saved preference
  if (!isLoaded) {
    return null;
  }

  return (
    <GluestackContext.Provider value={{ colorMode, setColorMode, toggleColorMode }}>
      <GluestackUIProvider config={gluestackConfig} colorMode={colorMode}>
        {children}
      </GluestackUIProvider>
    </GluestackContext.Provider>
  );
}
```

**Step 2: Create provider/index.ts**

```typescript
// packages/ui/src/provider/index.ts

export { GluestackProvider, useColorMode } from './GluestackProvider';
```

**Step 3: Commit**

```bash
git add packages/ui/src/provider/
git commit -m "feat(ui): add GluestackProvider with color mode support"
```

---

### Task 1.5: Create drawer state hook

**Files:**
- Create: `packages/ui/src/hooks/useDrawerState.ts`
- Create: `packages/ui/src/hooks/index.ts`

**Step 1: Create the drawer state hook**

```typescript
// packages/ui/src/hooks/useDrawerState.ts

import { useState, useEffect, useCallback } from 'react';
import { useWindowDimensions } from 'react-native';
import { drawerConfig, storageKeys } from '../theme';
import { storage } from '../utils/storage';

export type DrawerState = 'expanded' | 'collapsed' | 'hidden';

interface UseDrawerStateReturn {
  /** Current drawer state */
  state: DrawerState;
  /** Whether drawer is currently visible (expanded or collapsed) */
  isVisible: boolean;
  /** Whether drawer is in full expanded mode */
  isExpanded: boolean;
  /** Toggle between expanded and collapsed */
  toggle: () => void;
  /** Expand the drawer */
  expand: () => void;
  /** Collapse the drawer */
  collapse: () => void;
  /** Hide the drawer (mobile overlay mode) */
  hide: () => void;
  /** Current drawer width in pixels */
  width: number;
  /** Whether we're on a mobile-sized screen */
  isMobile: boolean;
}

export function useDrawerState(): UseDrawerStateReturn {
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < drawerConfig.breakpoints.mobile;
  const isTablet = screenWidth < drawerConfig.breakpoints.tablet;

  // Determine default state based on screen size
  const getDefaultState = useCallback((): DrawerState => {
    if (isMobile) return 'hidden';
    if (isTablet) return 'collapsed';
    return 'expanded';
  }, [isMobile, isTablet]);

  const [state, setState] = useState<DrawerState>(getDefaultState);
  const [userPreference, setUserPreference] = useState<'expanded' | 'collapsed' | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load user preference on mount
  useEffect(() => {
    const loadPreference = async () => {
      const saved = await storage.get(storageKeys.drawerCollapsed);
      if (saved === 'true') {
        setUserPreference('collapsed');
      } else if (saved === 'false') {
        setUserPreference('expanded');
      }
      setIsLoaded(true);
    };
    loadPreference();
  }, []);

  // Update state when screen size or user preference changes
  useEffect(() => {
    if (!isLoaded) return;

    if (isMobile) {
      setState('hidden');
    } else if (userPreference) {
      setState(userPreference);
    } else {
      setState(getDefaultState());
    }
  }, [isMobile, isTablet, userPreference, isLoaded, getDefaultState]);

  const toggle = useCallback(async () => {
    if (isMobile) {
      // On mobile, toggle between hidden and expanded (overlay)
      setState((prev) => (prev === 'hidden' ? 'expanded' : 'hidden'));
    } else {
      // On desktop/tablet, toggle between expanded and collapsed
      const newState = state === 'expanded' ? 'collapsed' : 'expanded';
      setState(newState);
      setUserPreference(newState);
      await storage.set(storageKeys.drawerCollapsed, newState === 'collapsed' ? 'true' : 'false');
    }
  }, [isMobile, state]);

  const expand = useCallback(async () => {
    setState('expanded');
    if (!isMobile) {
      setUserPreference('expanded');
      await storage.set(storageKeys.drawerCollapsed, 'false');
    }
  }, [isMobile]);

  const collapse = useCallback(async () => {
    if (isMobile) {
      setState('hidden');
    } else {
      setState('collapsed');
      setUserPreference('collapsed');
      await storage.set(storageKeys.drawerCollapsed, 'true');
    }
  }, [isMobile]);

  const hide = useCallback(() => {
    setState('hidden');
  }, []);

  const width =
    state === 'expanded'
      ? drawerConfig.expandedWidth
      : state === 'collapsed'
        ? drawerConfig.collapsedWidth
        : 0;

  return {
    state,
    isVisible: state !== 'hidden',
    isExpanded: state === 'expanded',
    toggle,
    expand,
    collapse,
    hide,
    width,
    isMobile,
  };
}
```

**Step 2: Create hooks/index.ts**

```typescript
// packages/ui/src/hooks/index.ts

export { useDrawerState } from './useDrawerState';
export type { DrawerState } from './useDrawerState';
```

**Step 3: Commit**

```bash
git add packages/ui/src/hooks/
git commit -m "feat(ui): add useDrawerState hook with persistence"
```

---

### Task 1.6: Create drawer components

**Files:**
- Create: `packages/ui/src/components/drawer/DrawerContext.tsx`
- Create: `packages/ui/src/components/drawer/DrawerItem.tsx`
- Create: `packages/ui/src/components/drawer/DrawerContent.tsx`
- Create: `packages/ui/src/components/drawer/index.ts`

**Step 1: Create DrawerContext**

```typescript
// packages/ui/src/components/drawer/DrawerContext.tsx

import React, { createContext, useContext, ReactNode } from 'react';
import { useDrawerState, DrawerState } from '../../hooks/useDrawerState';

interface DrawerContextValue {
  state: DrawerState;
  isVisible: boolean;
  isExpanded: boolean;
  toggle: () => void;
  expand: () => void;
  collapse: () => void;
  hide: () => void;
  width: number;
  isMobile: boolean;
  activeRoute: string;
  setActiveRoute: (route: string) => void;
  onNavigate: (route: string) => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawer must be used within DrawerProvider');
  }
  return context;
}

interface DrawerProviderProps {
  children: ReactNode;
  activeRoute: string;
  onNavigate: (route: string) => void;
}

export function DrawerProvider({ children, activeRoute, onNavigate }: DrawerProviderProps) {
  const drawerState = useDrawerState();
  const [currentRoute, setCurrentRoute] = React.useState(activeRoute);

  React.useEffect(() => {
    setCurrentRoute(activeRoute);
  }, [activeRoute]);

  const handleNavigate = (route: string) => {
    setCurrentRoute(route);
    onNavigate(route);
    // Auto-hide drawer on mobile after navigation
    if (drawerState.isMobile) {
      drawerState.hide();
    }
  };

  return (
    <DrawerContext.Provider
      value={{
        ...drawerState,
        activeRoute: currentRoute,
        setActiveRoute: setCurrentRoute,
        onNavigate: handleNavigate,
      }}
    >
      {children}
    </DrawerContext.Provider>
  );
}
```

**Step 2: Create DrawerItem**

```typescript
// packages/ui/src/components/drawer/DrawerItem.tsx

import React from 'react';
import { Pressable, Text, Box } from '@gluestack-ui/themed';
import { LucideIcon } from 'lucide-react-native';
import { useDrawer } from './DrawerContext';
import { brandColors } from '../../theme';

interface DrawerItemProps {
  route: string;
  label: string;
  icon: LucideIcon;
}

export function DrawerItem({ route, label, icon: Icon }: DrawerItemProps) {
  const { activeRoute, onNavigate, isExpanded } = useDrawer();
  const isActive = activeRoute === route;

  return (
    <Pressable
      onPress={() => onNavigate(route)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: isActive ? `${brandColors.primary500}15` : 'transparent',
        marginHorizontal: 8,
        marginVertical: 2,
      }}
    >
      <Icon
        size={22}
        color={isActive ? brandColors.primary600 : '#6b7280'}
        strokeWidth={isActive ? 2.5 : 2}
      />
      {isExpanded && (
        <Text
          style={{
            marginLeft: 12,
            fontSize: 15,
            fontWeight: isActive ? '600' : '400',
            color: isActive ? brandColors.primary600 : '#374151',
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
```

**Step 3: Create DrawerContent**

```typescript
// packages/ui/src/components/drawer/DrawerContent.tsx

import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Box, Divider } from '@gluestack-ui/themed';
import {
  Music,
  Calendar,
  Monitor,
  Image,
  Settings,
  Menu,
  ChevronLeft,
  LogOut,
  User,
} from 'lucide-react-native';
import { useDrawer } from './DrawerContext';
import { DrawerItem } from './DrawerItem';
import { brandColors, drawerConfig } from '../../theme';

interface DrawerContentProps {
  /** App name to display in header */
  appName?: string;
  /** Current user info */
  user?: {
    name: string;
    email?: string;
  } | null;
  /** Callback when sign out is pressed */
  onSignOut?: () => void;
  /** Custom navigation items (overrides defaults) */
  items?: Array<{
    route: string;
    label: string;
    icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  }>;
  /** Translation function for labels */
  t?: (key: string) => string;
}

const defaultItems = [
  { route: 'Songs', label: 'Songs', icon: Music },
  { route: 'Events', label: 'Events', icon: Calendar },
  { route: 'Displays', label: 'Displays', icon: Monitor },
  { route: 'Media', label: 'Media', icon: Image },
];

export function DrawerContent({
  appName = 'Mobile Worship',
  user,
  onSignOut,
  items,
  t = (key) => key,
}: DrawerContentProps) {
  const { isExpanded, toggle, width, state } = useDrawer();
  const navItems = items ?? defaultItems;

  if (state === 'hidden') {
    return null;
  }

  return (
    <View
      style={{
        width,
        height: '100%',
        backgroundColor: '#ffffff',
        borderRightWidth: 1,
        borderRightColor: '#e5e7eb',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: isExpanded ? 'space-between' : 'center',
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
          minHeight: 64,
        }}
      >
        {isExpanded && (
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: brandColors.primary600,
            }}
          >
            {appName}
          </Text>
        )}
        <Pressable
          onPress={toggle}
          style={{
            padding: 8,
            borderRadius: 8,
          }}
        >
          {isExpanded ? (
            <ChevronLeft size={20} color="#6b7280" />
          ) : (
            <Menu size={20} color="#6b7280" />
          )}
        </Pressable>
      </View>

      {/* Navigation Items */}
      <ScrollView style={{ flex: 1, paddingTop: 8 }}>
        {navItems.map((item) => (
          <DrawerItem
            key={item.route}
            route={item.route}
            label={t(`nav.${item.route.toLowerCase()}`) || item.label}
            icon={item.icon}
          />
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
        {/* Settings */}
        <DrawerItem
          route="Settings"
          label={t('nav.settings') || 'Settings'}
          icon={Settings}
        />

        {/* User info and sign out */}
        {user && (
          <View
            style={{
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: isExpanded ? 'space-between' : 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: brandColors.primary100,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <User size={16} color={brandColors.primary600} />
              </View>
              {isExpanded && (
                <View style={{ marginLeft: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>
                    {user.name}
                  </Text>
                  {user.email && (
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>{user.email}</Text>
                  )}
                </View>
              )}
            </View>
            {isExpanded && onSignOut && (
              <Pressable onPress={onSignOut} style={{ padding: 8 }}>
                <LogOut size={18} color="#6b7280" />
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
```

**Step 4: Create drawer/index.ts**

```typescript
// packages/ui/src/components/drawer/index.ts

export { DrawerProvider, useDrawer } from './DrawerContext';
export { DrawerItem } from './DrawerItem';
export { DrawerContent } from './DrawerContent';
```

**Step 5: Commit**

```bash
git add packages/ui/src/components/drawer/
git commit -m "feat(ui): add drawer components with context"
```

---

### Task 1.7: Create AppLayout component

**Files:**
- Create: `packages/ui/src/layouts/AppLayout.tsx`
- Create: `packages/ui/src/layouts/index.ts`

**Step 1: Create AppLayout**

```typescript
// packages/ui/src/layouts/AppLayout.tsx

import React, { ReactNode } from 'react';
import { View, Pressable, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { Menu } from 'lucide-react-native';
import { DrawerProvider, DrawerContent, useDrawer } from '../components/drawer';
import { drawerConfig, brandColors } from '../theme';

interface AppLayoutProps {
  children: ReactNode;
  activeRoute: string;
  onNavigate: (route: string) => void;
  user?: { name: string; email?: string } | null;
  onSignOut?: () => void;
  t?: (key: string) => string;
}

function AppLayoutInner({
  children,
  user,
  onSignOut,
  t,
}: Omit<AppLayoutProps, 'activeRoute' | 'onNavigate'>) {
  const { width, isMobile, isVisible, toggle, state } = useDrawer();
  const { width: screenWidth } = useWindowDimensions();

  return (
    <View style={styles.container}>
      {/* Mobile Header */}
      {isMobile && (
        <View style={styles.mobileHeader}>
          <Pressable onPress={toggle} style={styles.menuButton}>
            <Menu size={24} color="#374151" />
          </Pressable>
          <View style={styles.mobileTitle}>
            <View
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: brandColors.primary600,
              }}
            >
              {/* Title handled by parent */}
            </View>
          </View>
        </View>
      )}

      <View style={styles.body}>
        {/* Drawer */}
        {(isVisible || isMobile) && (
          <>
            {/* Mobile overlay backdrop */}
            {isMobile && state === 'expanded' && (
              <Pressable
                onPress={toggle}
                style={[
                  styles.backdrop,
                  { width: screenWidth },
                ]}
              />
            )}

            {/* Drawer content */}
            <View
              style={[
                styles.drawer,
                isMobile && state === 'expanded' && styles.drawerMobile,
                { width: state === 'hidden' ? 0 : width },
              ]}
            >
              <DrawerContent user={user} onSignOut={onSignOut} t={t} />
            </View>
          </>
        )}

        {/* Main content */}
        <View style={[styles.content, { marginLeft: isMobile ? 0 : width }]}>
          {children}
        </View>
      </View>
    </View>
  );
}

export function AppLayout({
  children,
  activeRoute,
  onNavigate,
  user,
  onSignOut,
  t,
}: AppLayoutProps) {
  return (
    <DrawerProvider activeRoute={activeRoute} onNavigate={onNavigate}>
      <AppLayoutInner user={user} onSignOut={onSignOut} t={t}>
        {children}
      </AppLayoutInner>
    </DrawerProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  mobileHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  menuButton: {
    padding: 8,
    marginRight: 8,
  },
  mobileTitle: {
    flex: 1,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 100,
  },
  drawerMobile: {
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 50,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
});
```

**Step 2: Create layouts/index.ts**

```typescript
// packages/ui/src/layouts/index.ts

export { AppLayout } from './AppLayout';
```

**Step 3: Commit**

```bash
git add packages/ui/src/layouts/
git commit -m "feat(ui): add AppLayout with responsive drawer"
```

---

### Task 1.8: Update packages/ui exports

**Files:**
- Modify: `packages/ui/src/index.ts`
- Create: `packages/ui/src/components/index.ts`

**Step 1: Create components/index.ts**

```typescript
// packages/ui/src/components/index.ts

export * from './drawer';
```

**Step 2: Update main index.ts**

```typescript
// packages/ui/src/index.ts

// Theme
export * from './theme';

// Provider
export * from './provider';

// Hooks
export * from './hooks';

// Utils
export * from './utils';

// Layouts
export * from './layouts';

// Components
export * from './components';

// Legacy exports (keep for backwards compatibility during migration)
export { SlidePreview } from './SlidePreview';
export { SongCard } from './SongCard';
export { EventCard } from './EventCard';
```

**Step 3: Run typecheck to verify**

Run: `cd packages/ui && pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/ui/src/
git commit -m "feat(ui): export all new components and update package structure"
```

---

## Phase 2: Web App Migration

### Task 2.1: Add web-specific dependencies

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Add react-native-web for Gluestack compatibility**

```json
{
  "dependencies": {
    "@mobileworship/protocol": "workspace:*",
    "@mobileworship/shared": "workspace:*",
    "@mobileworship/ui": "workspace:*",
    "@supabase/supabase-js": "^2.43.0",
    "@tanstack/react-query": "^5.32.0",
    "i18next": "^25.7.3",
    "i18next-browser-languagedetector": "^8.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-i18next": "^16.5.0",
    "react-native-web": "^0.19.0",
    "react-native-svg": "^15.2.0",
    "react-router-dom": "^6.23.0"
  }
}
```

**Step 2: Install dependencies**

Run: `pnpm install`
Expected: Dependencies installed

**Step 3: Update Vite config for react-native-web**

Read and modify `apps/web/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
  optimizeDeps: {
    include: ['react-native-web'],
  },
});
```

**Step 4: Commit**

```bash
git add apps/web/package.json apps/web/vite.config.ts pnpm-lock.yaml
git commit -m "feat(web): add react-native-web for Gluestack compatibility"
```

---

### Task 2.2: Create web-specific drawer wrapper

**Files:**
- Create: `apps/web/src/components/WebDrawerLayout.tsx`

**Step 1: Create the web drawer layout**

```typescript
// apps/web/src/components/WebDrawerLayout.tsx

import React, { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@mobileworship/shared';
import { AppLayout } from '@mobileworship/ui';

interface WebDrawerLayoutProps {
  children: ReactNode;
}

// Map routes to drawer route names
const routeMap: Record<string, string> = {
  '/dashboard/songs': 'Songs',
  '/dashboard/events': 'Events',
  '/dashboard/displays': 'Displays',
  '/dashboard/media': 'Media',
  '/dashboard/settings': 'Settings',
};

const reverseRouteMap: Record<string, string> = {
  Songs: '/dashboard/songs',
  Events: '/dashboard/events',
  Displays: '/dashboard/displays',
  Media: '/dashboard/media',
  Settings: '/dashboard/settings',
};

export function WebDrawerLayout({ children }: WebDrawerLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();

  // Determine active route from current path
  const activeRoute = Object.entries(routeMap).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1] ?? 'Songs';

  const handleNavigate = (route: string) => {
    const path = reverseRouteMap[route];
    if (path) {
      navigate(path);
    }
  };

  return (
    <AppLayout
      activeRoute={activeRoute}
      onNavigate={handleNavigate}
      user={user ? { name: user.name, email: user.email } : null}
      onSignOut={signOut}
      t={t}
    >
      {children}
    </AppLayout>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/WebDrawerLayout.tsx
git commit -m "feat(web): add WebDrawerLayout wrapper for routing integration"
```

---

### Task 2.3: Update web App.tsx with GluestackProvider

**Files:**
- Modify: `apps/web/src/App.tsx`

**Step 1: Read current App.tsx**

Run: Read the current file

**Step 2: Update with Gluestack provider**

```typescript
// apps/web/src/App.tsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseProvider, AuthProvider } from '@mobileworship/shared';
import { GluestackProvider } from '@mobileworship/ui';
import './i18n';

import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { SongsPage } from './pages/SongsPage';
import { SongDetailPage } from './pages/SongDetailPage';
import { EventsPage } from './pages/EventsPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { DisplaysPage } from './pages/DisplaysPage';
import { DisplayDetailPage } from './pages/DisplayDetailPage';
import { MediaPage } from './pages/MediaPage';
import { SettingsPage } from './pages/SettingsPage';
import { ControlPage } from './pages/ControlPage';
import { PresentationPage } from './pages/PresentationPage';
import { WebDrawerLayout } from './components/WebDrawerLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
    },
  },
});

function DashboardRoutes() {
  return (
    <WebDrawerLayout>
      <Routes>
        <Route index element={<Navigate to="songs" replace />} />
        <Route path="songs" element={<SongsPage />} />
        <Route path="songs/:id" element={<SongDetailPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="displays" element={<DisplaysPage />} />
        <Route path="displays/:id" element={<DisplayDetailPage />} />
        <Route path="media" element={<MediaPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Routes>
    </WebDrawerLayout>
  );
}

export default function App() {
  return (
    <GluestackProvider>
      <QueryClientProvider client={queryClient}>
        <SupabaseProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/accept-invite" element={<AcceptInvitePage />} />
                <Route path="/dashboard/*" element={<DashboardRoutes />} />
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

**Step 3: Run dev server to test**

Run: `pnpm dev:web`
Expected: App loads with drawer navigation

**Step 4: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): integrate GluestackProvider and drawer layout"
```

---

### Task 2.4: Remove old DashboardLayout

**Files:**
- Delete: `apps/web/src/pages/DashboardLayout.tsx`

**Step 1: Verify DashboardLayout is no longer imported**

Run: `grep -r "DashboardLayout" apps/web/src/`
Expected: No imports found (only the file itself)

**Step 2: Delete the file**

Run: `rm apps/web/src/pages/DashboardLayout.tsx`

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor(web): remove old DashboardLayout in favor of drawer"
```

---

## Phase 3: Client App Migration

### Task 3.1: Add drawer navigation dependency

**Files:**
- Modify: `apps/client/package.json`

**Step 1: Add @react-navigation/drawer**

```json
{
  "dependencies": {
    "@mobileworship/protocol": "workspace:*",
    "@mobileworship/shared": "workspace:*",
    "@mobileworship/ui": "workspace:*",
    "@react-navigation/bottom-tabs": "^6.5.0",
    "@react-navigation/drawer": "^6.6.0",
    "@react-navigation/native": "^6.1.0",
    "@react-navigation/native-stack": "^6.9.0",
    "@supabase/supabase-js": "^2.43.0",
    "@tanstack/react-query": "^5.32.0",
    "nativewind": "^2.0.0",
    "react": "18.2.0",
    "react-native": "0.74.0",
    "react-native-config": "^1.5.0",
    "react-native-gesture-handler": "^2.16.0",
    "react-native-reanimated": "^3.10.0",
    "react-native-safe-area-context": "^4.10.0",
    "react-native-screens": "^3.31.0",
    "react-native-svg": "^15.2.0",
    "react-native-url-polyfill": "^3.0.0",
    "react-native-zeroconf": "^0.13.0",
    "@react-native-async-storage/async-storage": "^2.2.0"
  }
}
```

**Step 2: Install dependencies**

Run: `pnpm install`

**Step 3: Update iOS pods**

Run: `cd apps/client/ios && pod install`

**Step 4: Commit**

```bash
git add apps/client/package.json pnpm-lock.yaml apps/client/ios/Podfile.lock
git commit -m "feat(client): add drawer navigation dependencies"
```

---

### Task 3.2: Update babel config for reanimated

**Files:**
- Modify: `apps/client/babel.config.js`

**Step 1: Add reanimated plugin**

```javascript
// apps/client/babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'nativewind/babel',
    'react-native-reanimated/plugin', // Must be last
  ],
};
```

**Step 2: Commit**

```bash
git add apps/client/babel.config.js
git commit -m "feat(client): add reanimated babel plugin for drawer animations"
```

---

### Task 3.3: Create native drawer content wrapper

**Files:**
- Create: `apps/client/src/navigation/NativeDrawerContent.tsx`

**Step 1: Create the native drawer content**

```typescript
// apps/client/src/navigation/NativeDrawerContent.tsx

import React from 'react';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useAuth } from '@mobileworship/shared';
import { DrawerProvider, DrawerContent } from '@mobileworship/ui';

export function NativeDrawerContent(props: DrawerContentComponentProps) {
  const { user, signOut } = useAuth();
  const { state, navigation } = props;

  // Get current route name
  const currentRoute = state.routes[state.index]?.name ?? 'Songs';

  const handleNavigate = (route: string) => {
    navigation.navigate(route);
  };

  return (
    <DrawerProvider activeRoute={currentRoute} onNavigate={handleNavigate}>
      <DrawerContent
        user={user ? { name: user.name, email: user.email } : null}
        onSignOut={signOut}
      />
    </DrawerProvider>
  );
}
```

**Step 2: Commit**

```bash
git add apps/client/src/navigation/NativeDrawerContent.tsx
git commit -m "feat(client): add NativeDrawerContent wrapper for React Navigation"
```

---

### Task 3.4: Update RootNavigator to use drawer

**Files:**
- Modify: `apps/client/src/navigation/RootNavigator.tsx`

**Step 1: Update to use drawer navigation**

```typescript
// apps/client/src/navigation/RootNavigator.tsx

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useAuth } from '@mobileworship/shared';

import { LoginScreen } from '../screens/LoginScreen';
import { SongsScreen } from '../screens/SongsScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { ControlScreen } from '../screens/ControlScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { DisplaysNavigator } from './DisplaysNavigator';
import { NativeDrawerContent } from './NativeDrawerContent';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Control: { eventId: string; authToken?: string };
};

export type DrawerParamList = {
  Songs: undefined;
  Events: undefined;
  Displays: undefined;
  Media: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

function MainDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <NativeDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'slide',
        drawerStyle: {
          width: 256,
        },
      }}
    >
      <Drawer.Screen name="Songs" component={SongsScreen} />
      <Drawer.Screen name="Events" component={EventsScreen} />
      <Drawer.Screen
        name="Displays"
        component={DisplaysNavigator}
      />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
    </Drawer.Navigator>
  );
}

export function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="Main" component={MainDrawer} />
          <Stack.Screen
            name="Control"
            component={ControlScreen}
            options={{ presentation: 'fullScreenModal' }}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
```

**Step 2: Commit**

```bash
git add apps/client/src/navigation/RootNavigator.tsx
git commit -m "feat(client): replace bottom tabs with drawer navigation"
```

---

### Task 3.5: Update client App.tsx with GluestackProvider

**Files:**
- Modify: `apps/client/App.tsx`

**Step 1: Add gesture handler import and provider**

```typescript
// apps/client/App.tsx

import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SupabaseProvider, AuthProvider } from '@mobileworship/shared';
import { GluestackProvider } from '@mobileworship/ui';

import { RootNavigator } from './src/navigation/RootNavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
    },
  },
});

export default function App() {
  return (
    <GluestackProvider>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SupabaseProvider>
            <AuthProvider>
              <NavigationContainer>
                <RootNavigator />
              </NavigationContainer>
            </AuthProvider>
          </SupabaseProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GluestackProvider>
  );
}
```

**Step 2: Run on iOS simulator to test**

Run: `pnpm dev:client` then `pnpm --filter @mobileworship/client ios`
Expected: App loads with drawer navigation

**Step 3: Commit**

```bash
git add apps/client/App.tsx
git commit -m "feat(client): integrate GluestackProvider and gesture handler"
```

---

## Phase 4: Host App Migration (Desktop Only)

### Task 4.1: Add host app dependencies

**Files:**
- Modify: `apps/host/package.json`

**Step 1: Add necessary dependencies**

Add to dependencies:
- `@react-navigation/native`
- `@react-navigation/drawer`
- `@react-navigation/native-stack`
- `react-native-gesture-handler`
- `react-native-reanimated`
- `react-native-screens`
- `react-native-safe-area-context`
- `react-native-svg`

**Step 2: Install dependencies**

Run: `pnpm install`

**Step 3: Commit**

```bash
git add apps/host/package.json pnpm-lock.yaml
git commit -m "feat(host): add navigation dependencies for desktop drawer"
```

---

### Task 4.2: Create host app navigator

**Files:**
- Create: `apps/host/src/navigation/HostNavigator.tsx`
- Create: `apps/host/src/navigation/HostDrawerContent.tsx`

**Step 1: Create HostDrawerContent**

```typescript
// apps/host/src/navigation/HostDrawerContent.tsx

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Monitor, Settings, QrCode } from 'lucide-react-native';
import { brandColors } from '@mobileworship/ui';

interface NavItemProps {
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  isActive: boolean;
  onPress: () => void;
}

function NavItem({ label, icon: Icon, isActive, onPress }: NavItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.navItem,
        isActive && styles.navItemActive,
      ]}
    >
      <Icon
        size={22}
        color={isActive ? brandColors.primary600 : '#6b7280'}
      />
      <Text style={[
        styles.navLabel,
        isActive && styles.navLabelActive,
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function HostDrawerContent(props: DrawerContentComponentProps) {
  const { state, navigation } = props;
  const currentRoute = state.routes[state.index]?.name ?? 'Display';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mobile Worship</Text>
        <Text style={styles.subtitle}>Display Host</Text>
      </View>

      <View style={styles.nav}>
        <NavItem
          label="Display"
          icon={Monitor}
          isActive={currentRoute === 'Display'}
          onPress={() => navigation.navigate('Display')}
        />
        <NavItem
          label="Pairing"
          icon={QrCode}
          isActive={currentRoute === 'Pairing'}
          onPress={() => navigation.navigate('Pairing')}
        />
        <NavItem
          label="Settings"
          icon={Settings}
          isActive={currentRoute === 'Settings'}
          onPress={() => navigation.navigate('Settings')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: brandColors.primary600,
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  nav: {
    flex: 1,
    paddingTop: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: `${brandColors.primary500}15`,
  },
  navLabel: {
    marginLeft: 12,
    fontSize: 15,
    color: '#374151',
  },
  navLabelActive: {
    fontWeight: '600',
    color: brandColors.primary600,
  },
});
```

**Step 2: Create HostNavigator**

```typescript
// apps/host/src/navigation/HostNavigator.tsx

import React from 'react';
import { Platform } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { DisplayScreen } from '../screens/DisplayScreen';
import { PairingScreen } from '../screens/PairingScreen';
import { HostDrawerContent } from './HostDrawerContent';

// Only use drawer on desktop platforms
const isDesktop = Platform.OS === 'macos' || Platform.OS === 'windows';

export type HostDrawerParamList = {
  Display: undefined;
  Pairing: undefined;
  Settings: undefined;
};

const Drawer = createDrawerNavigator<HostDrawerParamList>();

export function HostNavigator() {
  // On TV, just show DisplayScreen directly (no navigation)
  if (!isDesktop) {
    return <DisplayScreen />;
  }

  return (
    <Drawer.Navigator
      drawerContent={(props) => <HostDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'permanent',
        drawerStyle: {
          width: 240,
        },
      }}
      initialRouteName="Display"
    >
      <Drawer.Screen name="Display" component={DisplayScreen} />
      <Drawer.Screen name="Pairing" component={PairingScreen} />
    </Drawer.Navigator>
  );
}
```

**Step 3: Commit**

```bash
git add apps/host/src/navigation/
git commit -m "feat(host): add desktop drawer navigation (TV excluded)"
```

---

### Task 4.3: Update host App.tsx

**Files:**
- Modify: `apps/host/App.tsx`

**Step 1: Update with navigation and Gluestack**

```typescript
// apps/host/App.tsx

import 'react-native-gesture-handler';
import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import KeepAwake from 'react-native-keep-awake';
import { GluestackProvider } from '@mobileworship/ui';

import { HostNavigator } from './src/navigation/HostNavigator';
import { DisplayScreen } from './src/screens/DisplayScreen';

const queryClient = new QueryClient();

// TV platforms don't need navigation
const isTV = Platform.isTV;

export default function App() {
  // Simple mode for TV
  if (isTV) {
    return (
      <>
        <KeepAwake />
        <DisplayScreen />
      </>
    );
  }

  // Full navigation for desktop
  return (
    <GluestackProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <KeepAwake />
          <HostNavigator />
        </NavigationContainer>
      </QueryClientProvider>
    </GluestackProvider>
  );
}
```

**Step 2: Commit**

```bash
git add apps/host/App.tsx
git commit -m "feat(host): integrate drawer for desktop, keep TV simple"
```

---

## Phase 5: Cleanup and Testing

### Task 5.1: Update i18n keys for nav

**Files:**
- Modify: `apps/web/src/i18n/locales/en.json`
- Modify: `apps/web/src/i18n/locales/es.json`

**Step 1: Verify nav keys exist (they should already)**

Check for: `nav.songs`, `nav.events`, `nav.displays`, `nav.media`, `nav.settings`

**Step 2: Add any missing keys**

If `nav.media` is missing, add:
- en.json: `"media": "Media"`
- es.json: `"media": "Medios"`

**Step 3: Commit if changes made**

```bash
git add apps/web/src/i18n/
git commit -m "fix(web): ensure all nav i18n keys exist"
```

---

### Task 5.2: Run full test suite

**Step 1: Run linting**

Run: `pnpm lint`
Expected: No errors

**Step 2: Run type checking**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Run tests**

Run: `pnpm test`
Expected: All tests pass

**Step 4: Fix any issues and commit**

```bash
git add -A
git commit -m "fix: resolve linting and type errors from migration"
```

---

### Task 5.3: Manual testing checklist

**Web App:**
- [ ] Drawer visible on desktop (≥1024px)
- [ ] Drawer collapses when toggle clicked
- [ ] Drawer preference persists on reload
- [ ] Drawer hidden on mobile, hamburger shows overlay
- [ ] All nav items work
- [ ] Dark mode toggle works
- [ ] Sign out works

**iOS/Android Client:**
- [ ] Drawer opens on swipe from left edge
- [ ] Drawer opens on hamburger tap
- [ ] All nav items work
- [ ] Drawer auto-closes on mobile after navigation

**macOS/Windows Host:**
- [ ] Drawer visible permanently
- [ ] Display and Pairing screens work

**Android TV:**
- [ ] No drawer, DisplayScreen only
- [ ] Display functionality unchanged

---

### Task 5.4: Final commit and PR prep

**Step 1: Verify all changes committed**

Run: `git status`
Expected: Clean working tree

**Step 2: Squash/organize commits if needed**

Run: `git log --oneline -20` to review

**Step 3: Push branch**

Run: `git push -u origin feature/gluestack-drawer`

---

## Success Criteria

- [ ] `packages/ui` exports work on web, iOS, Android, macOS, Windows
- [ ] Drawer navigation functional on all platforms
- [ ] ~90% UI code reuse across platforms
- [ ] Dark mode works everywhere
- [ ] Brand colors easily changeable in `tokens.ts`
- [ ] No regression in existing functionality
- [ ] TV apps unaffected (display-only mode preserved)
- [ ] All tests pass
- [ ] Build succeeds for all platforms
