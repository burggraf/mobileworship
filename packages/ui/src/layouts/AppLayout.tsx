// packages/ui/src/layouts/AppLayout.tsx


import type { ReactNode } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Menu } from 'lucide-react-native';
import { DrawerProvider, DrawerContent, useDrawer } from '../components/drawer';
import { semanticColors } from '../theme';
import type { ColorScheme } from '../theme';

interface AppLayoutProps {
  children: ReactNode;
  activeRoute: string;
  onNavigate: (route: string) => void;
  user?: { name: string; email?: string } | null;
  onSignOut?: () => void;
  t?: (key: string) => string;
  colorScheme?: ColorScheme;
}

function AppLayoutInner({
  children,
  user,
  onSignOut,
  t,
}: Omit<AppLayoutProps, 'activeRoute' | 'onNavigate' | 'colorScheme'>) {
  const { width, isMobile, isVisible, toggle, state, colorScheme } = useDrawer();
  const { width: screenWidth } = useWindowDimensions();
  const colors = semanticColors[colorScheme];

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      {/* Mobile Header */}
      {isMobile && (
        <View style={[styles.mobileHeader, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <Pressable onPress={toggle} style={styles.menuButton}>
            <Menu size={24} color={colors.text} />
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
          <View style={styles.contentInner}>
            {children}
          </View>
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
  colorScheme = 'light',
}: AppLayoutProps) {
  return (
    <DrawerProvider activeRoute={activeRoute} onNavigate={onNavigate} colorScheme={colorScheme}>
      <AppLayoutInner user={user} onSignOut={onSignOut} t={t}>
        {children}
      </AppLayoutInner>
    </DrawerProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
  },
  mobileHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
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
    height: '100%',
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
    // @ts-expect-error - web-only overflow value
    overflowY: 'auto',
  },
  contentInner: {
    flex: 1,
    padding: 24,
    minHeight: '100%',
  },
});
