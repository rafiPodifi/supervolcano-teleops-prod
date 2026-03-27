import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MemberStackParamList } from '../../navigation/MemberNavigator';

const MascotImage = require('../../../assets/mascot/volcanomascotstill.png');

type NavigationProp = NativeStackNavigationProp<MemberStackParamList>;

// TODO: Replace with real data from Firestore
const MOCK_HOURS = 4.2;
const GOAL_HOURS = 10;
const MOCK_SESSIONS = [
  { id: '1', date: new Date(Date.now() - 86400000), duration: 47 },
  { id: '2', date: new Date(Date.now() - 86400000 * 3), duration: 72 },
];

function getEncouragingMessage(progress: number): string {
  if (progress === 0) return "Ready when you are.";
  if (progress < 0.2) return "You've started. That's huge.";
  if (progress < 0.5) return "Almost halfway there.";
  if (progress < 0.8) return "You're crushing it.";
  if (progress < 1) return "So close to your free clean!";
  return "You did it! 🎉";
}

export default function MemberHomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  
  const cardScale = useRef(new Animated.Value(0.95)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const mascotBounce = useRef(new Animated.Value(0)).current;
  
  const progress = MOCK_HOURS / GOAL_HOURS;
  const hoursRemaining = Math.max(0, GOAL_HOURS - MOCK_HOURS);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(mascotBounce, { toValue: -8, duration: 1000, useNativeDriver: true }),
        Animated.timing(mascotBounce, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleStartSession = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('MemberRecord');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back</Text>
        <TouchableOpacity 
          style={styles.settingsButton} 
          onPress={() => navigation.navigate('MemberSettings')}
        >
          <Ionicons name="settings-outline" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <Animated.View style={[styles.heroCard, { transform: [{ scale: cardScale }], opacity: cardOpacity }]}>
          <LinearGradient
            colors={['#10B981', '#059669', '#047857']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            {/* Decorative circles */}
            <View style={styles.heroDecoration}>
              <View style={[styles.decorCircle, styles.decorCircle1]} />
              <View style={[styles.decorCircle, styles.decorCircle2]} />
            </View>
            
            {/* Mascot with bounce */}
            <Animated.View style={[styles.mascotContainer, { transform: [{ translateY: mascotBounce }] }]}>
              <Image source={MascotImage} style={styles.mascotImage} resizeMode="contain" />
            </Animated.View>
            
            {/* Progress Ring */}
            <View style={styles.progressRingContainer}>
              <View style={styles.ringBackground} />
              <View style={[styles.ringProgress, {
                borderRightColor: progress > 0.25 ? 'rgba(255,255,255,0.9)' : 'transparent',
                borderBottomColor: progress > 0.5 ? 'rgba(255,255,255,0.9)' : 'transparent',
                borderLeftColor: progress > 0.75 ? 'rgba(255,255,255,0.9)' : 'transparent',
              }]} />
              <View style={styles.progressInner}>
                <Text style={styles.hoursNumber}>{MOCK_HOURS.toFixed(1)}</Text>
                <Text style={styles.hoursLabel}>/ {GOAL_HOURS} hrs</Text>
              </View>
            </View>
            
            <Text style={styles.encourageText}>{getEncouragingMessage(progress)}</Text>
            
            {/* CTA Button */}
            <TouchableOpacity style={styles.ctaButton} onPress={handleStartSession} activeOpacity={0.9}>
              <View style={styles.ctaContent}>
                <View style={styles.ctaIconContainer}>
                  <Ionicons name="videocam" size={22} color="#10B981" />
                </View>
                <View style={styles.ctaTextContainer}>
                  <Text style={styles.ctaTitle}>Start Cleaning Session</Text>
                  <Text style={styles.ctaSubtitle}>Your cleaning companion awaits</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
        
        {/* Recent Sessions */}
        {MOCK_SESSIONS.length > 0 && (
          <View style={styles.sessionsSection}>
            <Text style={styles.sectionTitle}>Recent</Text>
            {MOCK_SESSIONS.map((session) => (
              <View key={session.id} style={styles.sessionRow}>
                <Text style={styles.sessionDate}>{formatDate(session.date)}</Text>
                <Text style={styles.sessionDuration}>{formatDuration(session.duration)}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* Reward reminder */}
        <View style={styles.rewardReminder}>
          <View style={styles.rewardIcon}>
            <Ionicons name="gift" size={20} color="#10B981" />
          </View>
          <Text style={styles.rewardText}>
            {hoursRemaining.toFixed(1)} hours until your free professional clean
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function formatDate(date: Date): string {
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}hr ${mins}min` : `${hrs}hr`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  greeting: { fontSize: 16, color: '#6B7280', fontWeight: '500' },
  settingsButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  heroCard: { borderRadius: 24, overflow: 'hidden', shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 12 },
  heroGradient: { padding: 24, alignItems: 'center', overflow: 'hidden' },
  heroDecoration: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  decorCircle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  decorCircle1: { width: 200, height: 200, top: -60, right: -40 },
  decorCircle2: { width: 150, height: 150, bottom: -30, left: -30 },
  mascotContainer: { marginBottom: 16 },
  mascotImage: { width: 100, height: 100 },
  progressRingContainer: { width: 140, height: 140, position: 'relative', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  ringBackground: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 10, borderColor: 'rgba(255, 255, 255, 0.2)' },
  ringProgress: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 10, borderColor: 'rgba(255,255,255,0.9)', borderTopColor: 'transparent', transform: [{ rotate: '-90deg' }] },
  progressInner: { position: 'absolute', alignItems: 'center' },
  hoursNumber: { fontSize: 36, fontWeight: '800', color: '#fff' },
  hoursLabel: { fontSize: 14, color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' },
  encourageText: { fontSize: 16, color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500', marginBottom: 24, textAlign: 'center' },
  ctaButton: { backgroundColor: '#fff', borderRadius: 16, padding: 16, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  ctaContent: { flexDirection: 'row', alignItems: 'center' },
  ctaIconContainer: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  ctaTextContainer: { flex: 1 },
  ctaTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  ctaSubtitle: { fontSize: 13, color: '#6B7280' },
  sessionsSection: { marginTop: 32 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  sessionDate: { fontSize: 15, color: '#374151' },
  sessionDuration: { fontSize: 15, color: '#6B7280', fontWeight: '500' },
  rewardReminder: { flexDirection: 'row', alignItems: 'center', marginTop: 32, paddingVertical: 16, paddingHorizontal: 16, backgroundColor: '#ECFDF5', borderRadius: 12 },
  rewardIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rewardText: { flex: 1, fontSize: 14, color: '#065F46', fontWeight: '500' },
});

