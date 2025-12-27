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
