module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'nativewind/babel',
    'transform-inline-environment-variables',
    'react-native-reanimated/plugin', // Must be last
  ],
};
