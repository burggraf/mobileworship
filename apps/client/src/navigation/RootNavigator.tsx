import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useAuth } from '@mobileworship/shared';

import { LoginScreen } from '../screens/LoginScreen';
import { SongsScreen } from '../screens/SongsScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { ControlScreen } from '../screens/ControlScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MediaScreen } from '../screens/MediaScreen';
import { DisplaysNavigator } from './DisplaysNavigator';
import { NativeDrawerContent } from './NativeDrawerContent';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Control: { eventId: string; authToken?: string };
};

export type DrawerParamList = {
  Songs: undefined;
  Events: undefined;
  Displays: undefined;
  Media: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

function MainDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <NativeDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'slide',
        drawerStyle: { width: 256 },
      }}
    >
      <Drawer.Screen name="Songs" component={SongsScreen} />
      <Drawer.Screen name="Events" component={EventsScreen} />
      <Drawer.Screen name="Displays" component={DisplaysNavigator} />
      <Drawer.Screen name="Media" component={MediaScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
    </Drawer.Navigator>
  );
}

export function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="Main" component={MainDrawer} />
          <Stack.Screen
            name="Control"
            component={ControlScreen}
            options={{ presentation: 'fullScreenModal' }}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
