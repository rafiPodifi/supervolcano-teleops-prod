/**
 * VOLCANO MASCOT
 * Friendly animated character that accompanies the member
 * Reacts to different states: idle, recording, celebrating
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

type MascotMood = 'idle' | 'recording' | 'celebrating' | 'sleeping' | 'cheering';

interface Props {
  mood?: MascotMood;
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

const MESSAGES = {
  idle: ['Ready when you are', 'No rush', 'I\'m here'],
  recording: ['You\'re doing great!', 'Nice!', 'Keep going!', '🔥'],
  celebrating: ['Amazing!', 'You did it!', 'So proud!'],
  sleeping: ['zzz...', '💤'],
  cheering: ['YES!', 'Woohoo!', '🎉'],
};

export default function VolcanoMascot({ mood = 'idle', message, size = 'medium' }: Props) {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const sizeMap = {
    small: { container: 60, emoji: 32, text: 12 },
    medium: { container: 100, emoji: 56, text: 14 },
    large: { container: 140, emoji: 80, text: 16 },
  };

  const dimensions = sizeMap[size];

  useEffect(() => {
    if (mood === 'celebrating' || mood === 'cheering') {
      // Bounce animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, { toValue: -10, duration: 200, useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]),
        { iterations: 3 }
      ).start();
      // Scale pop
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.2, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    } else if (mood === 'recording') {
      // Gentle pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [mood]);

  const getEmoji = () => {
    switch (mood) {
      case 'celebrating':
      case 'cheering':
        return '🌋✨';
      case 'recording':
        return '🌋👀';
      case 'sleeping':
        return '🌋💤';
      default:
        return '🌋';
    }
  };

  const displayMessage = message || MESSAGES[mood][Math.floor(Math.random() * MESSAGES[mood].length)];

  return (
    <Animated.View 
      style={[
        styles.container,
        { 
          width: dimensions.container,
          height: dimensions.container,
          transform: [
            { translateY: bounceAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <Text style={[styles.emoji, { fontSize: dimensions.emoji }]}>{getEmoji()}</Text>
      {message !== undefined && (
        <View style={styles.speechBubble}>
          <Text style={[styles.message, { fontSize: dimensions.text }]}>{displayMessage}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    textAlign: 'center',
  },
  speechBubble: {
    position: 'absolute',
    bottom: -8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  message: {
    color: '#333',
    fontWeight: '600',
  },
});


