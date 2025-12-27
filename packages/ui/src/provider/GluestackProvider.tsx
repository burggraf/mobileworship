// packages/ui/src/provider/GluestackProvider.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
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
