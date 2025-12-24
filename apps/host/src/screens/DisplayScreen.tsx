import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import Video from 'react-native-video';
import type { HostState, ClientCommand } from '@mobileworship/protocol';
import { SlideRenderer } from '../components/SlideRenderer';
import { TransitionManager } from '../components/TransitionManager';
import { HostServer } from '../services/HostServer';

const { width, height } = Dimensions.get('window');

interface SlideContent {
  lines: string[];
  backgroundUrl?: string;
  backgroundType?: 'image' | 'video';
}

export function DisplayScreen() {
  const [isBlank, setIsBlank] = useState(false);
  const [isLogo, setIsLogo] = useState(true);
  const [currentSlide, setCurrentSlide] = useState<SlideContent | null>(null);
  const [connectedClients, setConnectedClients] = useState(0);
  const [hostServer, setHostServer] = useState<HostServer | null>(null);

  useEffect(() => {
    // Initialize host server for local connections
    const server = new HostServer({
      port: 9876,
      onCommand: handleCommand,
      onClientConnect: () => setConnectedClients((c) => c + 1),
      onClientDisconnect: () => setConnectedClients((c) => Math.max(0, c - 1)),
    });

    server.start();
    setHostServer(server);

    return () => {
      server.stop();
    };
  }, []);

  const handleCommand = useCallback((command: ClientCommand) => {
    switch (command.type) {
      case 'BLANK_SCREEN':
        setIsBlank(true);
        setIsLogo(false);
        break;
      case 'SHOW_LOGO':
        setIsLogo(true);
        setIsBlank(false);
        break;
      case 'UNBLANK':
        setIsBlank(false);
        setIsLogo(false);
        break;
      case 'GOTO_SLIDE':
        // Handle slide navigation
        setIsBlank(false);
        setIsLogo(false);
        // TODO: Update current slide based on event data
        break;
      case 'NEXT_SLIDE':
      case 'PREV_SLIDE':
        // TODO: Navigate slides
        break;
    }
  }, []);

  // Show blank screen
  if (isBlank) {
    return <View style={styles.container} />;
  }

  // Show logo screen
  if (isLogo) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.logo}>Mobile Worship</Text>
        <Text style={styles.subtitle}>
          {connectedClients > 0
            ? `${connectedClients} controller${connectedClients > 1 ? 's' : ''} connected`
            : 'Waiting for controllers...'}
        </Text>
      </View>
    );
  }

  // Show slide content
  return (
    <View style={styles.container}>
      {currentSlide ? (
        <SlideRenderer
          lines={currentSlide.lines}
          backgroundUrl={currentSlide.backgroundUrl}
          backgroundType={currentSlide.backgroundType}
        />
      ) : (
        <View style={[styles.container, styles.centered]}>
          <Text style={styles.subtitle}>No slide selected</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    width,
    height,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
  },
});
