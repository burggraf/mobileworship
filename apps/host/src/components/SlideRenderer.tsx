import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import Video from 'react-native-video';

const { width, height } = Dimensions.get('window');

interface SlideRendererProps {
  lines: string[];
  backgroundUrl?: string;
  backgroundType?: 'image' | 'video';
  textColor?: string;
  fontSize?: number;
}

export function SlideRenderer({
  lines,
  backgroundUrl,
  backgroundType = 'image',
  textColor = '#ffffff',
  fontSize = 64,
}: SlideRendererProps) {
  return (
    <View style={styles.container}>
      {/* Background Layer */}
      {backgroundUrl && backgroundType === 'image' && (
        <Image source={{ uri: backgroundUrl }} style={styles.background} resizeMode="cover" />
      )}
      {backgroundUrl && backgroundType === 'video' && (
        <Video
          source={{ uri: backgroundUrl }}
          style={styles.background}
          resizeMode="cover"
          repeat
          muted
        />
      )}

      {/* Overlay for text readability */}
      <View style={styles.overlay} />

      {/* Text Layer */}
      <View style={styles.textContainer}>
        {lines.map((line, index) => (
          <Text
            key={index}
            style={[
              styles.text,
              {
                color: textColor,
                fontSize,
                textShadowColor: 'rgba(0, 0, 0, 0.8)',
                textShadowOffset: { width: 2, height: 2 },
                textShadowRadius: 4,
              },
            ]}
          >
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width,
    height,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    width,
    height,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  text: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 8,
  },
});
