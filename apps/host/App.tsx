import 'react-native-gesture-handler';

import React from 'react';
import { Platform } from 'react-native';
import KeepAwake from 'react-native-keep-awake';
import { NavigationContainer } from '@react-navigation/native';
import { GluestackProvider } from '@mobileworship/ui';
import { DisplayScreen } from './src/screens/DisplayScreen';
import { HostNavigator } from './src/navigation/HostNavigator';

export default function App() {
  // TV mode: show simple DisplayScreen without navigation (remote control UX)
  // Desktop mode: show drawer navigation for settings access
  const isTV = Platform.isTV;

  if (isTV) {
    return (
      <>
        <KeepAwake />
        <DisplayScreen />
      </>
    );
  }

  // Desktop mode with drawer navigation
  return (
    <GluestackProvider>
      <NavigationContainer>
        <KeepAwake />
        <HostNavigator />
      </NavigationContainer>
    </GluestackProvider>
  );
}
