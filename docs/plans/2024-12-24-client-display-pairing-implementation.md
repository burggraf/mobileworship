# Client Display Pairing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add display pairing functionality to the client app so users can connect to host displays via QR code or 6-digit code.

**Architecture:** New Displays tab with stack navigator containing list, add, name, and detail screens. Shared hooks (`useDisplays`, `useDisplay`) handle data fetching and mutations. Service layer calls the existing `display-pairing` edge function.

**Tech Stack:** React Native, NativeWind, TanStack Query, Supabase Realtime, react-native-vision-camera (for QR scanning)

---

## Task 1: Create Display Pairing Service

**Files:**
- Create: `packages/shared/src/services/displayPairing.ts`

**Step 1: Create the service file**

```typescript
// packages/shared/src/services/displayPairing.ts
import type { Display, DeviceInfo } from '../types/display';

export interface ClaimDisplayResult {
  displayId: string;
  name: string;
  churchId: string;
}

export interface ValidateCodeResult {
  valid: boolean;
  displayId?: string;
  deviceInfo?: DeviceInfo;
}

export async function claimDisplay(
  supabaseUrl: string,
  accessToken: string,
  code: string,
  name: string,
  location?: string
): Promise<ClaimDisplayResult> {
  const response = await fetch(`${supabaseUrl}/functions/v1/display-pairing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'claim',
      code,
      name,
      location,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to claim display');
  }

  return response.json();
}

export function parseQRCode(qrValue: string): string | null {
  // Expected format: mobileworship://pair?code=123456
  try {
    const url = new URL(qrValue);
    if (url.protocol === 'mobileworship:' && url.pathname === '//pair') {
      const code = url.searchParams.get('code');
      if (code && /^\d{6}$/.test(code)) {
        return code;
      }
    }
  } catch {
    // Not a valid URL, check if it's just a 6-digit code
    if (/^\d{6}$/.test(qrValue)) {
      return qrValue;
    }
  }
  return null;
}
```

**Step 2: Commit**

```bash
git add packages/shared/src/services/displayPairing.ts
git commit -m "feat: add display pairing service with claimDisplay and parseQRCode"
```

---

## Task 2: Create useDisplays Hook

**Files:**
- Create: `packages/shared/src/hooks/useDisplays.ts`

**Step 1: Create the hook file**

```typescript
// packages/shared/src/hooks/useDisplays.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSupabase } from './useSupabase';
import { useAuth } from './useAuth';
import type { Display, DisplaySettings } from '../types/display';

interface DisplayRow {
  id: string;
  church_id: string;
  name: string;
  location: string | null;
  pairing_code: string | null;
  pairing_code_expires_at: string | null;
  paired_at: string | null;
  last_seen_at: string | null;
  device_info: Display['deviceInfo'];
  default_background_id: string | null;
  settings: DisplaySettings;
  created_at: string;
  updated_at: string;
}

function mapRowToDisplay(row: DisplayRow): Display {
  return {
    id: row.id,
    churchId: row.church_id,
    name: row.name,
    location: row.location,
    pairingCode: row.pairing_code,
    pairingCodeExpiresAt: row.pairing_code_expires_at,
    pairedAt: row.paired_at,
    lastSeenAt: row.last_seen_at,
    deviceInfo: row.device_info,
    defaultBackgroundId: row.default_background_id,
    settings: row.settings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isDisplayOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  const lastSeen = new Date(lastSeenAt).getTime();
  const now = Date.now();
  return now - lastSeen < 60000; // 60 seconds
}

export function useDisplays() {
  const supabase = useSupabase();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const displaysQuery = useQuery({
    queryKey: ['displays', user?.churchId],
    queryFn: async () => {
      if (!user?.churchId) return [];
      const { data, error } = await supabase
        .from('displays')
        .select('*')
        .eq('church_id', user.churchId)
        .not('paired_at', 'is', null)
        .order('name');
      if (error) throw error;
      return (data as DisplayRow[]).map(mapRowToDisplay);
    },
    enabled: !!user?.churchId,
  });

  // Subscribe to realtime updates for last_seen_at
  useEffect(() => {
    if (!user?.churchId) return;

    const channel = supabase
      .channel('displays-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'displays',
          filter: `church_id=eq.${user.churchId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['displays', user.churchId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user?.churchId, queryClient]);

  const removeDisplay = useMutation({
    mutationFn: async (displayId: string) => {
      const { error } = await supabase
        .from('displays')
        .update({
          church_id: null,
          paired_at: null,
          name: 'Unnamed Display',
          location: null,
        })
        .eq('id', displayId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['displays', user?.churchId] });
    },
  });

  return {
    displays: displaysQuery.data ?? [],
    isLoading: displaysQuery.isLoading,
    error: displaysQuery.error,
    refetch: displaysQuery.refetch,
    removeDisplay,
  };
}
```

**Step 2: Commit**

```bash
git add packages/shared/src/hooks/useDisplays.ts
git commit -m "feat: add useDisplays hook with realtime status updates"
```

---

## Task 3: Create useDisplay Hook

**Files:**
- Create: `packages/shared/src/hooks/useDisplay.ts`

**Step 1: Create the hook file**

```typescript
// packages/shared/src/hooks/useDisplay.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from './useSupabase';
import { useAuth } from './useAuth';
import type { Display, DisplaySettings } from '../types/display';

interface DisplayRow {
  id: string;
  church_id: string;
  name: string;
  location: string | null;
  pairing_code: string | null;
  pairing_code_expires_at: string | null;
  paired_at: string | null;
  last_seen_at: string | null;
  device_info: Display['deviceInfo'];
  default_background_id: string | null;
  settings: DisplaySettings;
  created_at: string;
  updated_at: string;
}

function mapRowToDisplay(row: DisplayRow): Display {
  return {
    id: row.id,
    churchId: row.church_id,
    name: row.name,
    location: row.location,
    pairingCode: row.pairing_code,
    pairingCodeExpiresAt: row.pairing_code_expires_at,
    pairedAt: row.paired_at,
    lastSeenAt: row.last_seen_at,
    deviceInfo: row.device_info,
    defaultBackgroundId: row.default_background_id,
    settings: row.settings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useDisplay(displayId: string | null) {
  const supabase = useSupabase();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const displayQuery = useQuery({
    queryKey: ['display', displayId],
    queryFn: async () => {
      if (!displayId) return null;
      const { data, error } = await supabase
        .from('displays')
        .select('*')
        .eq('id', displayId)
        .single();
      if (error) throw error;
      return mapRowToDisplay(data as DisplayRow);
    },
    enabled: !!displayId,
  });

  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<DisplaySettings>) => {
      if (!displayId || !displayQuery.data) throw new Error('No display');
      const newSettings = { ...displayQuery.data.settings, ...settings };
      const { error } = await supabase
        .from('displays')
        .update({ settings: newSettings })
        .eq('id', displayId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['display', displayId] });
      queryClient.invalidateQueries({ queryKey: ['displays', user?.churchId] });
    },
  });

  const updateName = useMutation({
    mutationFn: async ({ name, location }: { name: string; location?: string }) => {
      if (!displayId) throw new Error('No display');
      const { error } = await supabase
        .from('displays')
        .update({ name, location: location || null })
        .eq('id', displayId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['display', displayId] });
      queryClient.invalidateQueries({ queryKey: ['displays', user?.churchId] });
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!displayId) throw new Error('No display');
      const { error } = await supabase
        .from('displays')
        .update({
          church_id: null,
          paired_at: null,
          name: 'Unnamed Display',
          location: null,
        })
        .eq('id', displayId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['displays', user?.churchId] });
    },
  });

  const testConnection = async (): Promise<boolean> => {
    if (!displayId) return false;
    try {
      const channel = supabase.channel(`display:${displayId}`);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          channel.unsubscribe();
          resolve(false);
        }, 5000);

        channel
          .on('broadcast', { event: 'pong' }, () => {
            clearTimeout(timeout);
            channel.unsubscribe();
            resolve(true);
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              channel.send({ type: 'broadcast', event: 'ping', payload: {} });
            }
          });
      });
    } catch {
      return false;
    }
  };

  return {
    display: displayQuery.data ?? null,
    isLoading: displayQuery.isLoading,
    error: displayQuery.error,
    updateSettings,
    updateName,
    remove,
    testConnection,
  };
}
```

**Step 2: Commit**

```bash
git add packages/shared/src/hooks/useDisplay.ts
git commit -m "feat: add useDisplay hook with settings and connection testing"
```

---

## Task 4: Export New Hooks and Services

**Files:**
- Modify: `packages/shared/src/hooks/index.ts`
- Modify: `packages/shared/src/services/index.ts`

**Step 1: Update hooks index**

Add to `packages/shared/src/hooks/index.ts`:

```typescript
export { useDisplays, isDisplayOnline } from './useDisplays';
export { useDisplay } from './useDisplay';
```

**Step 2: Update services index**

Add to `packages/shared/src/services/index.ts`:

```typescript
export { claimDisplay, parseQRCode } from './displayPairing';
export type { ClaimDisplayResult, ValidateCodeResult } from './displayPairing';
```

**Step 3: Commit**

```bash
git add packages/shared/src/hooks/index.ts packages/shared/src/services/index.ts
git commit -m "feat: export display hooks and services from shared package"
```

---

## Task 5: Install Camera Dependencies

**Files:**
- Modify: `apps/client/package.json`

**Step 1: Install dependencies**

```bash
cd apps/client
pnpm add react-native-vision-camera@^4.0.0
```

**Step 2: For iOS, install pods**

```bash
cd ios && pod install && cd ..
```

**Step 3: Commit**

```bash
git add apps/client/package.json pnpm-lock.yaml
git commit -m "deps: add react-native-vision-camera for QR scanning"
```

---

## Task 6: Create DisplaysListScreen

**Files:**
- Create: `apps/client/src/screens/displays/DisplaysListScreen.tsx`

**Step 1: Create the screen file**

```typescript
// apps/client/src/screens/displays/DisplaysListScreen.tsx
import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDisplays, isDisplayOnline } from '@mobileworship/shared';
import type { DisplaysStackParamList } from '../../navigation/DisplaysNavigator';

type NavigationProp = NativeStackNavigationProp<DisplaysStackParamList>;

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Never';
  const date = new Date(lastSeenAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  return `${diffDay} days ago`;
}

export function DisplaysListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { displays, isLoading, refetch, removeDisplay } = useDisplays();

  const handleRemove = (displayId: string, displayName: string) => {
    Alert.alert(
      'Remove Display',
      `Are you sure you want to remove "${displayName}"? The display will need to be paired again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeDisplay.mutate(displayId),
        },
      ]
    );
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('AddDisplay')}
          className="mr-4"
        >
          <Text className="text-blue-500 text-lg font-semibold">+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  if (displays.length === 0 && !isLoading) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center p-8">
        <Text className="text-gray-500 dark:text-gray-400 text-center mb-6">
          No displays paired yet
        </Text>
        <TouchableOpacity
          className="bg-blue-500 px-6 py-3 rounded-lg"
          onPress={() => navigation.navigate('AddDisplay')}
        >
          <Text className="text-white font-semibold">Add Display</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <FlatList
        data={displays}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        renderItem={({ item }) => {
          const online = isDisplayOnline(item.lastSeenAt);
          return (
            <TouchableOpacity
              className="flex-row items-center p-4 border-b border-gray-200 dark:border-gray-700"
              onPress={() => navigation.navigate('DisplayDetail', { displayId: item.id })}
              onLongPress={() => handleRemove(item.id, item.name)}
            >
              <View
                className={`w-3 h-3 rounded-full mr-3 ${
                  online ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <View className="flex-1">
                <Text className="font-semibold text-gray-900 dark:text-white">
                  {item.name}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  Last seen: {formatLastSeen(item.lastSeenAt)}
                </Text>
              </View>
              <Text className="text-gray-400 text-xl">›</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
```

**Step 2: Commit**

```bash
git add apps/client/src/screens/displays/DisplaysListScreen.tsx
git commit -m "feat: add DisplaysListScreen with online status indicators"
```

---

## Task 7: Create AddDisplayScreen

**Files:**
- Create: `apps/client/src/screens/displays/AddDisplayScreen.tsx`

**Step 1: Create the screen file (manual entry first, QR later)**

```typescript
// apps/client/src/screens/displays/AddDisplayScreen.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DisplaysStackParamList } from '../../navigation/DisplaysNavigator';

type NavigationProp = NativeStackNavigationProp<DisplaysStackParamList>;

export function AddDisplayScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [mode, setMode] = useState<'scan' | 'manual'>('manual'); // Start with manual for now
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const fullCode = code.join('');
  const isComplete = fullCode.length === 6;

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];

    if (value.length > 1) {
      // Handle paste
      const digits = value.slice(0, 6).split('');
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newCode[index + i] = digit;
        }
      });
      setCode(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      newCode[index] = value;
      setCode(newCode);
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
    setError(null);
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    if (!isComplete) return;
    setIsValidating(true);
    setError(null);

    // Navigate to name screen with the code
    // The actual validation happens there when claiming
    navigation.navigate('NameDisplay', { code: fullCode });
    setIsValidating(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white dark:bg-gray-900"
    >
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Enter Display Code
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 text-center mb-8">
          Enter the 6-digit code shown on your display
        </Text>

        <View className="flex-row gap-2 mb-6">
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              className="w-12 h-14 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-center text-2xl font-bold text-gray-900 dark:text-white"
              value={digit}
              onChangeText={(value) => handleDigitChange(index, value)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={6}
              selectTextOnFocus
            />
          ))}
        </View>

        {error && (
          <Text className="text-red-500 text-center mb-4">{error}</Text>
        )}

        <TouchableOpacity
          className={`w-full py-4 rounded-lg ${
            isComplete && !isValidating
              ? 'bg-blue-500'
              : 'bg-gray-300 dark:bg-gray-700'
          }`}
          onPress={handleSubmit}
          disabled={!isComplete || isValidating}
        >
          {isValidating ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-semibold text-lg">
              Connect Display
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
```

**Step 2: Commit**

```bash
git add apps/client/src/screens/displays/AddDisplayScreen.tsx
git commit -m "feat: add AddDisplayScreen with 6-digit code entry"
```

---

## Task 8: Create NameDisplayScreen

**Files:**
- Create: `apps/client/src/screens/displays/NameDisplayScreen.tsx`

**Step 1: Create the screen file**

```typescript
// apps/client/src/screens/displays/NameDisplayScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useSupabase, useAuth } from '@mobileworship/shared';
import { claimDisplay } from '@mobileworship/shared';
import type { DisplaysStackParamList } from '../../navigation/DisplaysNavigator';

type NavigationProp = NativeStackNavigationProp<DisplaysStackParamList>;
type RouteType = RouteProp<DisplaysStackParamList, 'NameDisplay'>;

export function NameDisplayScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { code } = route.params;
  const supabase = useSupabase();
  const { session } = useAuth();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter a name for this display');
      return;
    }

    if (!session?.access_token) {
      setError('Not authenticated');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const supabaseUrl = (supabase as any).supabaseUrl || process.env.SUPABASE_URL;

      await claimDisplay(
        supabaseUrl,
        session.access_token,
        code,
        name.trim(),
        location.trim() || undefined
      );

      Alert.alert('Success', 'Display paired successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('DisplaysList'),
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pair display';
      if (message.includes('Invalid') || message.includes('expired')) {
        setError('Code not found or expired. Check the display and try again.');
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white dark:bg-gray-900"
    >
      <View className="flex-1 p-6">
        <View className="items-center mb-8">
          <View className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full items-center justify-center mb-4">
            <Text className="text-green-600 dark:text-green-400 text-2xl">✓</Text>
          </View>
          <Text className="text-xl font-semibold text-gray-900 dark:text-white">
            Display Found!
          </Text>
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Name *
          </Text>
          <TextInput
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white bg-white dark:bg-gray-800"
            placeholder="e.g., Main Sanctuary"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError(null);
            }}
            autoFocus
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Location (optional)
          </Text>
          <TextInput
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white bg-white dark:bg-gray-800"
            placeholder="e.g., Building A"
            placeholderTextColor="#9CA3AF"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {error && (
          <Text className="text-red-500 text-center mb-4">{error}</Text>
        )}

        <TouchableOpacity
          className={`py-4 rounded-lg ${
            name.trim() && !isSubmitting
              ? 'bg-blue-500'
              : 'bg-gray-300 dark:bg-gray-700'
          }`}
          onPress={handleSubmit}
          disabled={!name.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-semibold text-lg">
              Complete Setup
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
```

**Step 2: Commit**

```bash
git add apps/client/src/screens/displays/NameDisplayScreen.tsx
git commit -m "feat: add NameDisplayScreen for naming paired displays"
```

---

## Task 9: Create DisplayDetailScreen

**Files:**
- Create: `apps/client/src/screens/displays/DisplayDetailScreen.tsx`

**Step 1: Create the screen file**

```typescript
// apps/client/src/screens/displays/DisplayDetailScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useDisplay, isDisplayOnline } from '@mobileworship/shared';
import type { FontSize, TextPosition, FontFamily } from '@mobileworship/shared';
import type { DisplaysStackParamList } from '../../navigation/DisplaysNavigator';

type NavigationProp = NativeStackNavigationProp<DisplaysStackParamList>;
type RouteType = RouteProp<DisplaysStackParamList, 'DisplayDetail'>;

const FONT_SIZES: FontSize[] = ['small', 'medium', 'large', 'xlarge'];
const TEXT_POSITIONS: TextPosition[] = ['center', 'bottom', 'lower-third'];
const FONT_FAMILIES: FontFamily[] = ['system', 'serif', 'sans-serif'];

function SettingRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700"
      onPress={onPress}
    >
      <Text className="text-gray-900 dark:text-white">{label}</Text>
      <View className="flex-row items-center">
        <Text className="text-gray-500 dark:text-gray-400 mr-2 capitalize">
          {value}
        </Text>
        <Text className="text-gray-400">›</Text>
      </View>
    </TouchableOpacity>
  );
}

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Never';
  const date = new Date(lastSeenAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return date.toLocaleDateString();
}

export function DisplayDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { displayId } = route.params;
  const { display, isLoading, updateSettings, updateName, remove, testConnection } =
    useDisplay(displayId);

  const [isTesting, setIsTesting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [showPicker, setShowPicker] = useState<{
    type: 'fontSize' | 'textPosition' | 'fontFamily';
    current: string;
  } | null>(null);

  if (isLoading || !display) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const online = isDisplayOnline(display.lastSeenAt);

  const handleTestConnection = async () => {
    setIsTesting(true);
    const connected = await testConnection();
    setIsTesting(false);
    Alert.alert(
      connected ? 'Connected!' : 'Not Responding',
      connected
        ? 'The display is online and responding.'
        : 'The display did not respond. Make sure it is powered on and connected to the internet.'
    );
  };

  const handleRemove = () => {
    Alert.alert(
      'Remove Display',
      `Are you sure you want to remove "${display.name}"? The display will need to be paired again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await remove.mutateAsync();
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleEditSave = async () => {
    if (!editName.trim()) return;
    await updateName.mutateAsync({
      name: editName.trim(),
      location: editLocation.trim() || undefined,
    });
    setShowEditModal(false);
  };

  const openEditModal = () => {
    setEditName(display.name);
    setEditLocation(display.location || '');
    setShowEditModal(true);
  };

  const handlePickerSelect = async (value: string) => {
    if (!showPicker) return;
    await updateSettings.mutateAsync({
      [showPicker.type]: value,
    });
    setShowPicker(null);
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: display.name,
      headerRight: () => (
        <TouchableOpacity onPress={openEditModal} className="mr-4">
          <Text className="text-blue-500 font-medium">Edit</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, display.name]);

  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-900">
      {/* Status Section */}
      <View className="p-4 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row items-center mb-2">
          <Text className="text-gray-500 dark:text-gray-400 w-24">Status</Text>
          <View className="flex-row items-center">
            <View
              className={`w-3 h-3 rounded-full mr-2 ${
                online ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <Text className="text-gray-900 dark:text-white">
              {online ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
        {display.deviceInfo && (
          <View className="flex-row items-center mb-2">
            <Text className="text-gray-500 dark:text-gray-400 w-24">Device</Text>
            <Text className="text-gray-900 dark:text-white capitalize">
              {display.deviceInfo.platform} • {display.deviceInfo.resolution.width}×
              {display.deviceInfo.resolution.height}
            </Text>
          </View>
        )}
        <View className="flex-row items-center">
          <Text className="text-gray-500 dark:text-gray-400 w-24">Last seen</Text>
          <Text className="text-gray-900 dark:text-white">
            {formatLastSeen(display.lastSeenAt)}
          </Text>
        </View>
      </View>

      {/* Display Settings */}
      <View className="p-4">
        <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase">
          Display Settings
        </Text>

        <SettingRow
          label="Font Size"
          value={display.settings.fontSize}
          onPress={() =>
            setShowPicker({ type: 'fontSize', current: display.settings.fontSize })
          }
        />
        <SettingRow
          label="Text Position"
          value={display.settings.textPosition.replace('-', ' ')}
          onPress={() =>
            setShowPicker({ type: 'textPosition', current: display.settings.textPosition })
          }
        />
        <SettingRow
          label="Font Family"
          value={display.settings.fontFamily}
          onPress={() =>
            setShowPicker({ type: 'fontFamily', current: display.settings.fontFamily })
          }
        />

        <View className="flex-row items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
          <Text className="text-gray-900 dark:text-white">Text Shadow</Text>
          <Switch
            value={display.settings.textShadow}
            onValueChange={(value) => updateSettings.mutate({ textShadow: value })}
          />
        </View>
      </View>

      {/* Actions */}
      <View className="p-4 gap-3">
        <TouchableOpacity
          className="bg-blue-500 py-4 rounded-lg items-center"
          onPress={handleTestConnection}
          disabled={isTesting}
        >
          {isTesting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold">Test Connection</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="py-4 rounded-lg items-center"
          onPress={handleRemove}
        >
          <Text className="text-red-500 font-semibold">Remove Display</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-gray-800 rounded-t-xl p-6">
            <Text className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Edit Display
            </Text>

            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 mb-4 text-gray-900 dark:text-white"
              value={editName}
              onChangeText={setEditName}
            />

            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Location
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 mb-6 text-gray-900 dark:text-white"
              value={editLocation}
              onChangeText={setEditLocation}
              placeholder="Optional"
              placeholderTextColor="#9CA3AF"
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-4 rounded-lg bg-gray-200 dark:bg-gray-700"
                onPress={() => setShowEditModal(false)}
              >
                <Text className="text-center font-semibold text-gray-900 dark:text-white">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-4 rounded-lg bg-blue-500"
                onPress={handleEditSave}
              >
                <Text className="text-center font-semibold text-white">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Picker Modal */}
      <Modal visible={!!showPicker} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-gray-800 rounded-t-xl p-6">
            <Text className="text-xl font-semibold text-gray-900 dark:text-white mb-4 capitalize">
              {showPicker?.type.replace(/([A-Z])/g, ' $1').trim()}
            </Text>

            {(showPicker?.type === 'fontSize'
              ? FONT_SIZES
              : showPicker?.type === 'textPosition'
              ? TEXT_POSITIONS
              : FONT_FAMILIES
            ).map((option) => (
              <TouchableOpacity
                key={option}
                className="py-4 border-b border-gray-200 dark:border-gray-700"
                onPress={() => handlePickerSelect(option)}
              >
                <Text
                  className={`capitalize ${
                    option === showPicker?.current
                      ? 'text-blue-500 font-semibold'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {option.replace('-', ' ')}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              className="mt-4 py-4 rounded-lg bg-gray-200 dark:bg-gray-700"
              onPress={() => setShowPicker(null)}
            >
              <Text className="text-center font-semibold text-gray-900 dark:text-white">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
```

**Step 2: Commit**

```bash
git add apps/client/src/screens/displays/DisplayDetailScreen.tsx
git commit -m "feat: add DisplayDetailScreen with settings and connection testing"
```

---

## Task 10: Create DisplaysNavigator and Integrate

**Files:**
- Create: `apps/client/src/navigation/DisplaysNavigator.tsx`
- Modify: `apps/client/src/navigation/RootNavigator.tsx`

**Step 1: Create the navigator file**

```typescript
// apps/client/src/navigation/DisplaysNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DisplaysListScreen } from '../screens/displays/DisplaysListScreen';
import { AddDisplayScreen } from '../screens/displays/AddDisplayScreen';
import { NameDisplayScreen } from '../screens/displays/NameDisplayScreen';
import { DisplayDetailScreen } from '../screens/displays/DisplayDetailScreen';

export type DisplaysStackParamList = {
  DisplaysList: undefined;
  AddDisplay: undefined;
  NameDisplay: { code: string };
  DisplayDetail: { displayId: string };
};

const Stack = createNativeStackNavigator<DisplaysStackParamList>();

export function DisplaysNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="DisplaysList"
        component={DisplaysListScreen}
        options={{ title: 'Displays' }}
      />
      <Stack.Screen
        name="AddDisplay"
        component={AddDisplayScreen}
        options={{ title: 'Add Display' }}
      />
      <Stack.Screen
        name="NameDisplay"
        component={NameDisplayScreen}
        options={{ title: 'Name Display' }}
      />
      <Stack.Screen
        name="DisplayDetail"
        component={DisplayDetailScreen}
        options={{ title: 'Display' }}
      />
    </Stack.Navigator>
  );
}
```

**Step 2: Update RootNavigator to include Displays tab**

Replace `apps/client/src/navigation/RootNavigator.tsx` with:

```typescript
// apps/client/src/navigation/RootNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '@mobileworship/shared';

import { LoginScreen } from '../screens/LoginScreen';
import { SongsScreen } from '../screens/SongsScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { ControlScreen } from '../screens/ControlScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { DisplaysNavigator } from './DisplaysNavigator';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Control: { eventId: string };
};

export type MainTabParamList = {
  Songs: undefined;
  Events: undefined;
  Displays: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Songs" component={SongsScreen} />
      <Tab.Screen name="Events" component={EventsScreen} />
      <Tab.Screen
        name="Displays"
        component={DisplaysNavigator}
        options={{ headerShown: false }}
      />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
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

**Step 3: Commit**

```bash
git add apps/client/src/navigation/DisplaysNavigator.tsx apps/client/src/navigation/RootNavigator.tsx
git commit -m "feat: add Displays tab with navigator integration"
```

---

## Task 11: Export Types from Shared Package

**Files:**
- Modify: `packages/shared/src/types/index.ts`

**Step 1: Ensure display types are exported**

Check `packages/shared/src/types/index.ts` and ensure it includes:

```typescript
export * from './display';
```

**Step 2: Commit if changed**

```bash
git add packages/shared/src/types/index.ts
git commit -m "feat: export display types from shared package"
```

---

## Task 12: Final Verification

**Step 1: Run type checking**

```bash
pnpm typecheck
```

Expected: No type errors

**Step 2: Run linting**

```bash
pnpm lint
```

Expected: No lint errors (or only pre-existing ones)

**Step 3: Run tests**

```bash
pnpm test
```

Expected: All tests pass

**Step 4: Create summary commit**

```bash
git log --oneline -10
```

Verify all feature commits are in place.

---

## Summary

This implementation adds:

1. **Shared package additions:**
   - `displayPairing.ts` service for claiming displays
   - `useDisplays` hook for listing displays with realtime status
   - `useDisplay` hook for single display management

2. **Client app additions:**
   - `DisplaysNavigator` stack navigator
   - `DisplaysListScreen` with online/offline indicators
   - `AddDisplayScreen` with 6-digit code entry
   - `NameDisplayScreen` for naming new displays
   - `DisplayDetailScreen` with settings and connection testing

3. **Navigation:**
   - New "Displays" tab in main tab bar
   - Full stack navigation within Displays tab

**Not included (future tasks):**
- QR code scanning (requires camera permissions setup)
- Deep link handling
- i18n translations
