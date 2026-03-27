/**
 * JOURNEY PATH
 * Visual path showing progress from 0 to 10 hours
 * Milestones at key points with icons
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  currentHours: number;
  totalHours?: number;
}

const MILESTONES = [
  { hours: 0, icon: 'flag-outline', label: 'Start' },
  { hours: 2, icon: 'water-outline', label: '2hr' },
  { hours: 5, icon: 'star-outline', label: '5hr' },
  { hours: 8, icon: 'flame-outline', label: '8hr' },
  { hours: 10, icon: 'gift-outline', label: 'Free Clean!' },
];

export default function JourneyPath({ currentHours, totalHours = 10 }: Props) {
  const progress = Math.min(currentHours / totalHours, 1);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Journey</Text>
      
      {/* Path container */}
      <View style={styles.pathContainer}>
        {/* Background track */}
        <View style={styles.track} />
        
        {/* Filled progress */}
        <View style={[styles.trackFilled, { width: `${progress * 100}%` }]} />
        
        {/* Current position indicator */}
        <View style={[styles.currentPosition, { left: `${progress * 100}%` }]}>
          <View style={styles.currentDot} />
          <Text style={styles.currentLabel}>{currentHours.toFixed(1)}hr</Text>
        </View>
        
        {/* Milestones */}
        {MILESTONES.map((milestone, index) => {
          const position = (milestone.hours / totalHours) * 100;
          const isReached = currentHours >= milestone.hours;
          const isCurrent = index < MILESTONES.length - 1 
            ? currentHours >= milestone.hours && currentHours < MILESTONES[index + 1].hours
            : currentHours >= milestone.hours;

          return (
            <View 
              key={milestone.hours} 
              style={[styles.milestone, { left: `${position}%` }]}
            >
              <View style={[
                styles.milestoneIcon,
                isReached && styles.milestoneIconReached,
                isCurrent && styles.milestoneIconCurrent,
              ]}>
                <Ionicons 
                  name={isReached ? milestone.icon.replace('-outline', '') as any : milestone.icon as any}
                  size={16}
                  color={isReached ? '#fff' : '#999'}
                />
              </View>
              <Text style={[
                styles.milestoneLabel,
                isReached && styles.milestoneLabelReached,
              ]}>
                {milestone.label}
              </Text>
            </View>
          );
        })}
      </View>
      
      {/* Progress text */}
      <Text style={styles.progressText}>
        {currentHours.toFixed(1)} of {totalHours} hours
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 24,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pathContainer: {
    height: 60,
    position: 'relative',
    marginBottom: 12,
  },
  track: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
  },
  trackFilled: {
    position: 'absolute',
    top: 12,
    left: 0,
    height: 6,
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  currentPosition: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    marginLeft: -12,
  },
  currentDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  currentLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 4,
  },
  milestone: {
    position: 'absolute',
    top: 4,
    alignItems: 'center',
    marginLeft: -14,
  },
  milestoneIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneIconReached: {
    backgroundColor: '#10B981',
  },
  milestoneIconCurrent: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  milestoneLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  milestoneLabelReached: {
    color: '#10B981',
    fontWeight: '600',
  },
  progressText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
});


