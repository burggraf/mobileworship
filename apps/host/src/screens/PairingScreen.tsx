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

  useEffect(() => {
    generateCode();
  }, [generateCode]);

  useEffect(() => {
    if (!displayId) return;

    realtimeService.connect(
      displayId,
      () => {},
      async (name, churchId) => {
        await pairingService.savePairing(displayId);
        onPaired(displayId, name, churchId);
      }
    );

    return () => {
      realtimeService.disconnect();
    };
  }, [displayId, onPaired]);

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
    // TV overscan safe area - ~5% margins (54px at 1080p)
    paddingTop: 54,
    paddingBottom: 54,
    paddingHorizontal: 96,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#000',
    borderRadius: 16,
    marginBottom: 20,
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
    marginBottom: 24,
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
