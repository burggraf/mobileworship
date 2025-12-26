import React, { useState, useEffect, useCallback, useReducer } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import type { ClientCommand, HostState, SlideContent } from '../types';
import type { DisplaySettings } from '../types';
import { DEFAULT_DISPLAY_SETTINGS } from '../types';
import { SlideRenderer } from '../components/SlideRenderer';
import { pairingService } from '../services/PairingService';
import { realtimeService } from '../services/RealtimeService';
import { PairingScreen } from './PairingScreen';
import { ReadyScreen } from './ReadyScreen';

const { width, height } = Dimensions.get('window');

type AppState =
  | { screen: 'loading' }
  | { screen: 'pairing'; existingDisplayId?: string }
  | { screen: 'ready'; displayId: string; name: string; churchId: string; settings: DisplaySettings }
  | { screen: 'display'; displayId: string; name: string; churchId: string; settings: DisplaySettings };

type Action =
  | { type: 'INIT_UNPAIRED'; existingDisplayId?: string }
  | { type: 'INIT_PAIRED'; displayId: string; name: string; churchId: string; settings: DisplaySettings }
  | { type: 'PAIRED'; displayId: string; name: string; churchId: string }
  | { type: 'REMOVED' }
  | { type: 'EVENT_LOADED' }
  | { type: 'EVENT_UNLOADED' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'INIT_UNPAIRED':
      return { screen: 'pairing', existingDisplayId: action.existingDisplayId };
    case 'INIT_PAIRED':
      return { screen: 'ready', displayId: action.displayId, name: action.name, churchId: action.churchId, settings: action.settings };
    case 'PAIRED':
      return { screen: 'ready', displayId: action.displayId, name: action.name, churchId: action.churchId, settings: DEFAULT_DISPLAY_SETTINGS };
    case 'REMOVED':
      return { screen: 'pairing' };
    case 'EVENT_LOADED':
      if (state.screen === 'ready') return { ...state, screen: 'display' };
      return state;
    case 'EVENT_UNLOADED':
      if (state.screen === 'display') return { ...state, screen: 'ready' };
      return state;
    default:
      return state;
  }
}


export function DisplayScreen() {
  console.log('DisplayScreen rendering');
  const [appState, dispatch] = useReducer(reducer, { screen: 'loading' });
  const [hostState, setHostState] = useState<HostState>({
    displayId: '',
    eventId: null,
    currentItemIndex: 0,
    currentSectionIndex: 0,
    currentSlideIndex: 0,
    isBlank: false,
    isLogo: true,
    transition: 'fade',
    connectedClients: 0,
    lastUpdated: Date.now(),
  });
  const [currentSlide, setCurrentSlide] = useState<SlideContent | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    async function init() {
      console.log('DisplayScreen init starting');
      const result = await pairingService.initialize();
      console.log('DisplayScreen init result:', JSON.stringify(result));
      if (result.paired && result.displayId) {
        dispatch({
          type: 'INIT_PAIRED',
          displayId: result.displayId,
          name: result.name || 'Display',
          churchId: result.churchId || '',
          settings: result.settings || DEFAULT_DISPLAY_SETTINGS,
        });
      } else {
        // Pass existing displayId if display exists but needs re-pairing
        dispatch({ type: 'INIT_UNPAIRED', existingDisplayId: result.displayId });
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (appState.screen !== 'ready' && appState.screen !== 'display') return;

    realtimeService.connect(appState.displayId, handleCommand, undefined, handleRemoved);
    setIsConnected(true);

    return () => {
      realtimeService.disconnect();
      setIsConnected(false);
    };
  }, [appState.screen === 'ready' || appState.screen === 'display' ? appState.displayId : null, handleRemoved]);

  useEffect(() => {
    if (isConnected) {
      realtimeService.broadcastState(hostState);
    }
  }, [hostState, isConnected]);

  const handleCommand = useCallback((command: ClientCommand) => {
    console.log('Received command:', command.type);
    switch (command.type) {
      case 'LOAD_EVENT':
        dispatch({ type: 'EVENT_LOADED' });
        setHostState(s => ({ ...s, eventId: command.eventId, isLogo: false }));
        break;
      case 'UNLOAD_EVENT':
        dispatch({ type: 'EVENT_UNLOADED' });
        setHostState(s => ({ ...s, eventId: null, isLogo: true }));
        setCurrentSlide(null);
        break;
      case 'SET_SLIDE':
        dispatch({ type: 'EVENT_LOADED' });
        setCurrentSlide(command.slide);
        setHostState(s => ({ ...s, isBlank: false, isLogo: false, lastUpdated: Date.now() }));
        break;
      case 'BLANK_SCREEN':
        setHostState(s => ({ ...s, isBlank: true, isLogo: false }));
        break;
      case 'SHOW_LOGO':
        setHostState(s => ({ ...s, isLogo: true, isBlank: false }));
        break;
      case 'UNBLANK':
        setHostState(s => ({ ...s, isBlank: false, isLogo: false }));
        break;
      case 'GOTO_SLIDE':
        setHostState(s => ({ ...s, currentSlideIndex: command.slideIndex, isBlank: false, isLogo: false, lastUpdated: Date.now() }));
        break;
      case 'NEXT_SLIDE':
        setHostState(s => ({ ...s, currentSlideIndex: s.currentSlideIndex + 1, lastUpdated: Date.now() }));
        break;
      case 'PREV_SLIDE':
        setHostState(s => ({ ...s, currentSlideIndex: Math.max(0, s.currentSlideIndex - 1), lastUpdated: Date.now() }));
        break;
      case 'SET_TRANSITION':
        setHostState(s => ({ ...s, transition: command.transition }));
        break;
    }
  }, []);

  const handlePaired = useCallback((displayId: string, name: string, churchId: string) => {
    dispatch({ type: 'PAIRED', displayId, name, churchId });
  }, []);

  const handleRemoved = useCallback(async () => {
    console.log('Display removed from church');
    await pairingService.clearPairing();
    dispatch({ type: 'REMOVED' });
  }, []);

  if (appState.screen === 'loading') {
    return <View style={styles.container}><Text style={styles.loadingText}>Loading...</Text></View>;
  }

  if (appState.screen === 'pairing') {
    return <PairingScreen onPaired={handlePaired} existingDisplayId={appState.existingDisplayId} />;
  }

  if (appState.screen === 'ready') {
    return <ReadyScreen displayName={appState.name} isConnected={isConnected} settings={appState.settings} />;
  }

  if (hostState.isBlank) {
    return <View style={styles.container} />;
  }

  if (hostState.isLogo) {
    return <View style={[styles.container, styles.centered]}><Text style={styles.logo}>Mobile Worship</Text></View>;
  }

  return (
    <View style={styles.container}>
      {currentSlide ? (
        <SlideRenderer lines={currentSlide.lines} backgroundUrl={currentSlide.backgroundUrl} settings={appState.settings} />
      ) : (
        <View style={[styles.container, styles.centered]}><Text style={styles.subtitle}>No slide selected</Text></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', width, height },
  centered: { justifyContent: 'center', alignItems: 'center' },
  logo: { fontSize: 48, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 18, color: '#666' },
  loadingText: { fontSize: 18, color: '#888' },
});
