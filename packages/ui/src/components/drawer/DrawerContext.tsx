// packages/ui/src/components/drawer/DrawerContext.tsx

import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useDrawerState } from '../../hooks/useDrawerState';
import type { DrawerState } from '../../hooks/useDrawerState';

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
