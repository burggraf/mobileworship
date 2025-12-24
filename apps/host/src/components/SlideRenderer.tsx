import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { DisplaySettings } from '@mobileworship/shared';

interface Props {
  lines: string[];
  backgroundUrl?: string;
  backgroundType?: 'image' | 'video';
  settings: DisplaySettings;
}

const FONT_SIZES: Record<DisplaySettings['fontSize'], number> = {
  small: 32, medium: 48, large: 64, xlarge: 80,
};

export function SlideRenderer({ lines, backgroundUrl, settings }: Props) {
  const fontSize = FONT_SIZES[settings.fontSize];
  const textContainerStyle = {
    paddingTop: `${settings.margins.top}%`,
    paddingBottom: `${settings.margins.bottom}%`,
    paddingLeft: `${settings.margins.left}%`,
    paddingRight: `${settings.margins.right}%`,
    justifyContent: settings.textPosition === 'center' ? 'center' : 'flex-end',
  };
  const textStyle = {
    fontSize,
    fontFamily: settings.fontFamily === 'serif' ? 'Georgia' : settings.fontFamily === 'sans-serif' ? 'Helvetica' : undefined,
    textShadowColor: settings.textShadow ? 'rgba(0, 0, 0, 0.8)' : 'transparent',
    textShadowOffset: settings.textShadow ? { width: 2, height: 2 } : { width: 0, height: 0 },
    textShadowRadius: settings.textShadow ? 4 : 0,
  };

  return (
    <View style={styles.container}>
      {backgroundUrl && <Image source={{ uri: backgroundUrl }} style={styles.background} resizeMode="cover" />}
      {settings.overlayOpacity > 0 && <View style={[styles.overlay, { opacity: settings.overlayOpacity }]} />}
      <View style={[styles.textContainer, textContainerStyle]}>
        {lines.map((line, index) => <Text key={index} style={[styles.line, textStyle]}>{line}</Text>)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  background: { ...StyleSheet.absoluteFillObject },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  textContainer: { flex: 1, alignItems: 'center' },
  line: { color: '#fff', textAlign: 'center', marginVertical: 4 },
});
