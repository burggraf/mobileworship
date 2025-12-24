import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import KeepAwake from 'react-native-keep-awake';
import { PairingScreen } from './src/screens/PairingScreen';
import { pairingService } from './src/services/PairingService';
import type { DisplaySettings } from './src/types';
import { DEFAULT_DISPLAY_SETTINGS } from './src/types';

type AppState =
  | { screen: 'loading' }
  | { screen: 'pairing' }
  | { screen: 'ready'; displayId: string; name: string; churchId: string; settings: DisplaySettings };

export default function App() {
  const [appState, setAppState] = useState<AppState>({ screen: 'loading' });

  // Initialize pairing on mount
  useEffect(() => {
    async function init() {
      try {
        const result = await pairingService.initialize();
        if (result.paired && result.displayId) {
          setAppState({
            screen: 'ready',
            displayId: result.displayId,
            name: result.name || 'Display',
            churchId: result.churchId || '',
            settings: result.settings || DEFAULT_DISPLAY_SETTINGS,
          });
        } else {
          setAppState({ screen: 'pairing' });
        }
      } catch (error) {
        console.error('Init error:', error);
        setAppState({ screen: 'pairing' });
      }
    }
    init();
  }, []);

  const handlePaired = useCallback((displayId: string, name: string, churchId: string) => {
    setAppState({
      screen: 'ready',
      displayId,
      name,
      churchId,
      settings: DEFAULT_DISPLAY_SETTINGS,
    });
  }, []);

  // Render based on app state
  if (appState.screen === 'loading') {
    return (
      <View style={styles.container}>
        <KeepAwake />
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (appState.screen === 'pairing') {
    return (
      <>
        <KeepAwake />
        <PairingScreen onPaired={handlePaired} />
      </>
    );
  }

  // Ready screen - display paired and waiting for event
  return (
    <View style={styles.container}>
      <KeepAwake />
      <View style={styles.statusIndicator}>
        <View style={styles.dot} />
        <Text style={styles.statusText}>Connected</Text>
      </View>
      <Text style={styles.displayName}>{appState.name}</Text>
      <Text style={styles.waitingText}>Waiting for event...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#888',
    marginTop: 20,
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
    backgroundColor: '#4f4',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#fff',
  },
  displayName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  waitingText: {
    fontSize: 18,
    color: '#888',
  },
});
