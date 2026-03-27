/**
 * VOLCANO MASCOT COMPONENT
 * Displays the flame mascot - static or animated
 */

import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

interface MascotProps {
  size?: number;
  animated?: boolean;
  style?: any;
}

export default function Mascot({ size = 80, animated = false, style }: MascotProps) {
  if (animated) {
    return (
      <View style={[styles.container, { width: size, height: size }, style]}>
        <Video
          source={require('../../../assets/mascot/volcanomascotvid.mp4')}
          style={{ width: size, height: size }}
          resizeMode={ResizeMode.CONTAIN}
          isLooping
          shouldPlay
          isMuted
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Image
        source={require('../../../assets/mascot/volcanomascotstill.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

