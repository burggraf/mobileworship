// packages/ui/src/layouts/AppLayout.tsx


import type { ReactNode } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Menu } from 'lucide-react-native';
import { DrawerProvider, DrawerContent, useDrawer } from '../components/drawer';

interface AppLayoutProps {
  children: ReactNode;
  activeRoute: string;
  onNavigate: (route: string) => void;
  user?: { name: string; email?: string } | null;
  onSignOut?: () => void;
  t?: (key: string) => string;
}

function AppLayoutInner({
  children,
  user,
  onSignOut,
  t,
}: Omit<AppLayoutProps, 'activeRoute' | 'onNavigate'>) {
  const { width, isMobile, isVisible, toggle, state } = useDrawer();
  const { width: screenWidth } = useWindowDimensions();

  return (
    <View style={styles.container}>
      {/* Mobile Header */}
      {isMobile && (
        <View style={styles.mobileHeader}>
          <Pressable onPress={toggle} style={styles.menuButton}>
            <Menu size={24} color="#374151" />
          </Pressable>
          <View style={styles.mobileTitle}>
            {/* Title handled by parent */}
          </View>
        </View>
      )}

      <View style={styles.body}>
        {/* Drawer */}
        {(isVisible || isMobile) && (
          <>
            {/* Mobile overlay backdrop */}
            {isMobile && state === 'expanded' && (
              <Pressable
                onPress={toggle}
                style={[
                  styles.backdrop,
                  { width: screenWidth },
                ]}
              />
            )}

            {/* Drawer content */}
            <View
              style={[
                styles.drawer,
                isMobile && state === 'expanded' && styles.drawerMobile,
                { width: state === 'hidden' ? 0 : width },
              ]}
            >
              <DrawerContent user={user} onSignOut={onSignOut} t={t} />
            </View>
          </>
        )}

        {/* Main content */}
        <View style={[styles.content, { marginLeft: isMobile ? 0 : width }]}>
          {children}
        </View>
      </View>
    </View>
  );
}

export function AppLayout({
  children,
  activeRoute,
  onNavigate,
  user,
  onSignOut,
  t,
}: AppLayoutProps) {
  return (
    <DrawerProvider activeRoute={activeRoute} onNavigate={onNavigate}>
      <AppLayoutInner user={user} onSignOut={onSignOut} t={t}>
        {children}
      </AppLayoutInner>
    </DrawerProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  mobileHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  menuButton: {
    padding: 8,
    marginRight: 8,
  },
  mobileTitle: {
    flex: 1,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 100,
  },
  drawerMobile: {
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 50,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
});
