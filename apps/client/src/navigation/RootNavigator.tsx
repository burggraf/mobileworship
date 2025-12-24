import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '@mobileworship/shared';

import { LoginScreen } from '../screens/LoginScreen';
import { SongsScreen } from '../screens/SongsScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { ControlScreen } from '../screens/ControlScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Control: { eventId: string };
};

export type MainTabParamList = {
  Songs: undefined;
  Events: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Songs" component={SongsScreen} />
      <Tab.Screen name="Events" component={EventsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
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
          <Stack.Screen name="Main" component={MainTabs} />
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
