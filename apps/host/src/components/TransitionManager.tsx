import React, { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import type { TransitionType } from '@mobileworship/shared';

const { width, height } = Dimensions.get('window');

interface TransitionManagerProps {
  children: React.ReactNode;
  transition: TransitionType;
  triggerKey: string | number; // Changes when slide changes
}

export function TransitionManager({ children, transition, triggerKey }: TransitionManagerProps) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    switch (transition) {
      case 'fade':
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
        break;

      case 'slide-left':
        slideAnim.setValue(width);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
        break;

      case 'slide-right':
        slideAnim.setValue(-width);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
        break;

      case 'dissolve':
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
        break;

      case 'none':
      default:
        // No animation
        break;
    }
  }, [triggerKey, transition]);

  const animatedStyle = {
    opacity: fadeAnim,
    transform: [{ translateX: slideAnim }],
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>{children}</Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width,
    height,
  },
});
