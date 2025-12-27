// packages/ui/src/theme/index.ts

import { createConfig } from '@gluestack-style/react';
import { brandColors, drawerConfig, storageKeys, semanticColors } from './tokens';
import type { ColorScheme } from './tokens';

export const gluestackConfig = createConfig({
  aliases: {
    bg: 'backgroundColor',
    bgColor: 'backgroundColor',
    rounded: 'borderRadius',
    h: 'height',
    w: 'width',
    p: 'padding',
    px: 'paddingHorizontal',
    py: 'paddingVertical',
    m: 'margin',
    mx: 'marginHorizontal',
    my: 'marginVertical',
  },
  tokens: {
    colors: {
      // Brand colors
      ...Object.fromEntries(
        Object.entries(brandColors).map(([key, value]) => [`primary${key.replace('primary', '')}`, value])
      ),
      // Keep defaults for other semantic colors (error, success, warning, info)
    },
    space: {
      'px': 1,
      '0': 0,
      '0.5': 2,
      '1': 4,
      '1.5': 6,
      '2': 8,
      '2.5': 10,
      '3': 12,
      '3.5': 14,
      '4': 16,
      '5': 20,
      '6': 24,
      '7': 28,
      '8': 32,
      '9': 36,
      '10': 40,
      '12': 48,
      '16': 64,
      '20': 80,
      '24': 96,
      '32': 128,
    },
    radii: {
      'none': 0,
      'xs': 2,
      'sm': 4,
      'md': 6,
      'lg': 8,
      'xl': 12,
      '2xl': 16,
      '3xl': 24,
      'full': 9999,
    },
  },
});

export { brandColors, drawerConfig, storageKeys, semanticColors };
export type { ColorScheme };
export type GluestackConfig = typeof gluestackConfig;
