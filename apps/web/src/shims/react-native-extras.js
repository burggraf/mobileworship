// Shims for react-native components/APIs not available in react-native-web
// Used to make native-only packages work on web

import * as RNW from 'react-native-web';

// Re-export everything from react-native-web
export * from 'react-native-web';

// Shim for InputAccessoryView (iOS-only)
export const InputAccessoryView = () => null;

// Shim for TurboModuleRegistry (new architecture)
export const TurboModuleRegistry = {
  get: () => null,
  getEnforcing: () => {
    throw new Error('TurboModuleRegistry is not available on web');
  },
};

// Default export
export default {
  ...RNW.default,
  InputAccessoryView,
  TurboModuleRegistry,
};
