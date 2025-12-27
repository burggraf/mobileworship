import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            'react-native': path.resolve(__dirname, './node_modules/react-native-web'),
        },
        extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'],
    },
    define: {
        __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    },
    optimizeDeps: {
        include: ['react-native-web', 'react-native-svg'],
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        commonjsOptions: {
            transformMixedEsModules: true,
        },
    },
});
