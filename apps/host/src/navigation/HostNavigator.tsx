// apps/host/src/navigation/HostNavigator.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { HostDrawerContent } from './HostDrawerContent';
import { DisplayScreen } from '../screens/DisplayScreen';
import { PairingScreen } from '../screens/PairingScreen';

export type DrawerParamList = {
  Display: undefined;
  Pairing: undefined;
  Settings: undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();

// Placeholder Settings Screen
function SettingsScreen() {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderTitle}>Settings</Text>
      <Text style={styles.placeholderText}>Display settings coming soon...</Text>
    </View>
  );
}

// Wrapper for PairingScreen to handle navigation props
function PairingScreenWrapper() {
  // The drawer navigation version doesn't need the onPaired callback
  // since navigation handles screen switching
  return (
    <PairingScreen
      onPaired={() => {
        // Pairing complete - the DisplayScreen will handle the paired state
        console.log('Display paired via navigation drawer');
      }}
    />
  );
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const activeRoute = props.state.routes[props.state.index]?.name ?? 'Display';

  return (
    <HostDrawerContent
      activeRoute={activeRoute}
      onNavigate={(route) => {
        props.navigation.navigate(route);
      }}
    />
  );
}

export function HostNavigator() {
  return (
    <Drawer.Navigator
      initialRouteName="Display"
      drawerContent={CustomDrawerContent}
      screenOptions={{
        headerShown: false,
        drawerType: 'permanent',
        drawerStyle: {
          width: 256,
        },
      }}
    >
      <Drawer.Screen name="Display" component={DisplayScreen} />
      <Drawer.Screen name="Pairing" component={PairingScreenWrapper} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholderContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 16,
    color: '#888',
  },
});
