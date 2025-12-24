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
