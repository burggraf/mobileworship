#!/bin/bash
# Fix Android libraries for AGP 8.0+ namespace requirement
# Adds namespace to build.gradle and removes package from AndroidManifest.xml

cd "$(dirname "$0")/.." || exit 1

# Fix react-native-tcp-socket
TCP_BUILD="node_modules/react-native-tcp-socket/android/build.gradle"
TCP_MANIFEST="node_modules/react-native-tcp-socket/android/src/main/AndroidManifest.xml"
if [ -f "$TCP_BUILD" ]; then
  if ! grep -q 'namespace' "$TCP_BUILD"; then
    sed -i '' 's/android {/android {\n    namespace "com.asterinet.react.tcpsocket"/' "$TCP_BUILD"
    echo "Added namespace to $TCP_BUILD"
  fi
fi
if [ -f "$TCP_MANIFEST" ]; then
  sed -i '' 's/package="com.asterinet.react.tcpsocket"//' "$TCP_MANIFEST"
  echo "Fixed $TCP_MANIFEST"
fi

# Fix react-native-network-info
NETWORK_BUILD="node_modules/react-native-network-info/android/build.gradle"
NETWORK_MANIFEST="node_modules/react-native-network-info/android/src/main/AndroidManifest.xml"
if [ -f "$NETWORK_BUILD" ]; then
  if ! grep -q 'namespace' "$NETWORK_BUILD"; then
    sed -i '' 's/android {/android {\n    namespace "com.pusherman.networkinfo"/' "$NETWORK_BUILD"
    echo "Added namespace to $NETWORK_BUILD"
  fi
fi
if [ -f "$NETWORK_MANIFEST" ]; then
  sed -i '' 's/package="com.pusherman.networkinfo"//' "$NETWORK_MANIFEST"
  echo "Fixed $NETWORK_MANIFEST"
fi

echo "Android library fixes complete"
