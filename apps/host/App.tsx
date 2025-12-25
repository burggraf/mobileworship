import React from 'react';
import KeepAwake from 'react-native-keep-awake';
import { DisplayScreen } from './src/screens/DisplayScreen';

export default function App() {
  return (
    <>
      <KeepAwake />
      <DisplayScreen />
    </>
  );
}
