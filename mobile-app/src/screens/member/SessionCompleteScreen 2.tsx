/**
 * SESSION COMPLETE SCREEN
 * 
 * Shown after recording session ends
 * Celebrates accomplishment, shows progress update
 * ADHD-friendly: encouraging, not performative
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MemberStackParamList } from '../../navigation/MemberNavigator';

const MascotImage = require('../../../assets/mascot/volcanomascotstill.png');
const { width } = Dimensions.get('window');

// Contextual messages based on session duration
function getSessionMessage(minutes: number): string {
  if (minutes < 5) return "Every minute counts. You showed up.";
  if (minutes < 15) return "A solid start. Your space thanks you.";
  if (minutes < 30) return "That's real progress right there.";
  if (minutes < 45) return "Almost an hour. Impressive commitment.";
  if (minutes < 60) return "That's a serious session. Well done.";
  if (minutes < 90) return "Over an hour! You're a cleaning machine.";
  return "Incredible dedication. You should be proud.";
}

type NavigationProp = NativeStackNavigationProp<MemberStackParamList>;
type RouteParams = RouteProp<MemberStackParamList, 'SessionComplete'>;

export default function SessionCompleteScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const insets = useSafeAreaInsets();
  
  // Get params (with defaults for safety)
  const sessionMinutes = route.params?.sessionMinutes ?? 0;
  const totalHours = route.params?.totalHours ?? 0;
  const goalHours = route.params?.goalHours ?? 10;
  
  const hoursRemaining = Math.max(0, goalHours - totalHours);
  const progress = Math.min(totalHours / goalHours, 1);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const mascotBounce = useRef(new Animated.Value(0)).current;
  const timeScaleAnim = useRef(new Animated.Value(0)).current;
  const progressWidthAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  
  // Confetti ref
  const confettiRef = useRef<any>(null);

  useEffect(() => {
    // Haptic success
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Fire confetti
    setTimeout(() => confettiRef.current?.start(), 300);
    
    // Entrance animations
    Animated.sequence([
      // Fade in background
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // Time pops in
      Animated.spring(timeScaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }),
      // Progress bar fills
      Animated.timing(progressWidthAnim, {
        toValue: progress,
        duration: 800,
        useNativeDriver: false,
      }),
      // Buttons slide up
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Mascot bounce loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(mascotBounce, {
          toValue: -12,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(mascotBounce, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Extra haptic on time reveal
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 600);
  }, []);

  const handleDone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('MemberHome');
  };

  const handleStartAnother = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.replace('MemberRecord');
  };

  const formatSessionTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hrs} hr`;
    return `${hrs} hr ${mins} min`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Confetti */}
      <ConfettiCannon
        ref={confettiRef}
        count={150}
        origin={{ x: width / 2, y: -20 }}
        autoStart={false}
        fadeOut
        explosionSpeed={350}
        fallSpeed={3000}
        colors={['#10B981', '#34D399', '#6EE7B7', '#FCD34D', '#FBBF24', '#F59E0B']}
      />
      
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Mascot */}
        <Animated.View style={[styles.mascotContainer, { transform: [{ translateY: mascotBounce }] }]}>
          <Image source={MascotImage} style={styles.mascotImage} resizeMode="contain" />
        </Animated.View>
        
        {/* Title */}
        <Text style={styles.title}>Session Complete</Text>
        
        {/* Time Card */}
        <Animated.View 
          style={[
            styles.timeCard,
            { transform: [{ scale: timeScaleAnim }] },
          ]}
        >
          <Text style={styles.plusSign}>+</Text>
          <Text style={styles.timeValue}>{formatSessionTime(sessionMinutes)}</Text>
        </Animated.View>
        
        {/* Message */}
        <Text style={styles.message}>{getSessionMessage(sessionMinutes)}</Text>
        
        {/* Divider */}
        <View style={styles.divider} />
        
        {/* Progress Section */}
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>Total Progress</Text>
          
          <View style={styles.progressBarContainer}>
            <Animated.View 
              style={[
                styles.progressBarFill,
                {
                  width: progressWidthAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]} 
            />
          </View>
          
          <Text style={styles.progressText}>
            {totalHours.toFixed(1)} / {goalHours} hours
          </Text>
          
          {hoursRemaining > 0 && (
            <View style={styles.remainingContainer}>
              <Ionicons name="gift-outline" size={16} color="#10B981" />
              <Text style={styles.remainingText}>
                {hoursRemaining.toFixed(1)} hours until free clean
              </Text>
            </View>
          )}
        </View>
        
        {/* Buttons */}
        <Animated.View 
          style={[
            styles.buttonContainer,
            { transform: [{ translateY: slideUpAnim }] },
          ]}
        >
          {/* Primary: Done */}
          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={handleDone}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButtonGradient}
            >
              <Text style={styles.primaryButtonText}>Done</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          {/* Secondary: Start Another */}
          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={handleStartAnother}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color="#10B981" />
            <Text style={styles.secondaryButtonText}>Start Another Session</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  
  // Mascot
  mascotContainer: {
    marginBottom: 16,
  },
  mascotImage: {
    width: 100,
    height: 100,
  },
  
  // Title
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 24,
  },
  
  // Time Card
  timeCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 48,
    flexDirection: 'row',
    alignItems: 'baseline',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 16,
  },
  plusSign: {
    fontSize: 32,
    fontWeight: '700',
    color: '#10B981',
    marginRight: 4,
  },
  timeValue: {
    fontSize: 42,
    fontWeight: '800',
    color: '#111827',
  },
  
  // Message
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  
  // Divider
  divider: {
    width: 60,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 32,
  },
  
  // Progress
  progressSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  progressBarContainer: {
    width: '100%',
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  remainingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  remainingText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  
  // Buttons
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  secondaryButtonText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
  },
});

