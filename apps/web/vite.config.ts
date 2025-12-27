import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const shimsDir = path.resolve(__dirname, './src/shims');
const rnExtrasShim = path.resolve(shimsDir, 'react-native-extras.js');
const svgShim = path.resolve(shimsDir, 'react-native-svg.js');
const codegenShim = path.resolve(shimsDir, 'codegenNativeComponent.js');

// Plugin to handle react-native web shims
function reactNativeWebShims(): Plugin {
  return {
    name: 'react-native-web-shims',
    enforce: 'pre',
    resolveId(source) {
      // Intercept fabric codegen imports
      if (source === 'react-native/Libraries/Utilities/codegenNativeComponent') {
        return codegenShim;
      }
      // Use extended react-native shim with additional exports
      if (source === 'react-native') {
        return rnExtrasShim;
      }
      // Use react-native-svg shim
      if (source === 'react-native-svg') {
        return svgShim;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [reactNativeWebShims(), react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // Use lucide-react instead of lucide-react-native for web
      { find: 'lucide-react-native', replacement: path.resolve(__dirname, './node_modules/lucide-react') },
    ],
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'],
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
  optimizeDeps: {
    include: ['react-native-web', 'lucide-react', 'normalize-css-color'],
    exclude: ['react-native-svg'],
    esbuildOptions: {
      plugins: [
        {
          name: 'react-native-shims',
          setup(build) {
            // Redirect react-native to our extended shim
            build.onResolve({ filter: /^react-native$/ }, () => ({
              path: rnExtrasShim,
            }));
            // Redirect react-native-svg to our shim
            build.onResolve({ filter: /^react-native-svg$/ }, () => ({
              path: svgShim,
            }));
            // Redirect fabric codegen
            build.onResolve({ filter: /codegenNativeComponent$/ }, () => ({
              path: codegenShim,
            }));
            // Redirect lucide-react-native to lucide-react
            build.onResolve({ filter: /^lucide-react-native$/ }, () => ({
              path: path.resolve(__dirname, './node_modules/lucide-react/dist/esm/lucide-react.js'),
            }));
          },
        },
      ],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
