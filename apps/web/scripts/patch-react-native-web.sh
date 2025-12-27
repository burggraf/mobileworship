#!/bin/bash
# Patch react-native-web with missing exports for web compatibility
# This script is run after pnpm install

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RNW_DIR="$SCRIPT_DIR/../node_modules/react-native-web/dist"

if [ ! -d "$RNW_DIR" ]; then
  echo "react-native-web not found, skipping patch"
  exit 0
fi

mkdir -p "$RNW_DIR/exports"

# Create InputAccessoryView shim (iOS-only component)
cat > "$RNW_DIR/exports/InputAccessoryView.js" << 'EOF'
// Shim for InputAccessoryView (iOS-only component)
const InputAccessoryView = () => null;
export default InputAccessoryView;
EOF

# Create TurboModuleRegistry shim (new architecture)
cat > "$RNW_DIR/exports/TurboModuleRegistry.js" << 'EOF'
// Shim for TurboModuleRegistry (new architecture - not available on web)
const TurboModuleRegistry = {
  get: () => null,
  getEnforcing: (name) => {
    console.warn(`TurboModuleRegistry.getEnforcing('${name}') called on web - returning null`);
    return null;
  },
};
export default TurboModuleRegistry;
EOF

# Add exports to index.js if not already present
if ! grep -q "InputAccessoryView" "$RNW_DIR/index.js"; then
  echo "" >> "$RNW_DIR/index.js"
  echo "// Web shims for native-only components" >> "$RNW_DIR/index.js"
  echo "export { default as InputAccessoryView } from './exports/InputAccessoryView';" >> "$RNW_DIR/index.js"
  echo "export { default as TurboModuleRegistry } from './exports/TurboModuleRegistry';" >> "$RNW_DIR/index.js"
  echo "Patched react-native-web with web shims"
else
  echo "react-native-web already patched"
fi
