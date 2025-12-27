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
