// Shim for react-native/Libraries/Utilities/codegenNativeComponent
// Used by react-native-svg fabric components on web (no-op)
export default function codegenNativeComponent(name) {
  return () => null;
}
