import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, StatusBar, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchJobsForLocation } from '../services/api';
import { Job, Location } from '../types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/Design';
import { getFriendlyErrorCopy } from '@/utils/user-facing-error';

export default function JobSelectScreen({ route, navigation }: any) {
  const { location } = route.params as { location: Location };
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  async function loadJobs() {
    try {
      setLoading(true);
      const jobsList = await fetchJobsForLocation(location.id);
      setJobs(jobsList);
    } catch (error) {
      const friendly = getFriendlyErrorCopy(error, 'tasks');
      Alert.alert(friendly.title, friendly.message);
    } finally {
      setLoading(false);
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return { bg: Colors.priorityHigh, text: Colors.priorityHighText };
      case 'medium': return { bg: Colors.priorityMedium, text: Colors.priorityMediumText };
      default: return { bg: Colors.priorityLow, text: Colors.priorityLowText };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Select Job</Text>
          <Text style={styles.headerSubtitle}>{location.name}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading jobs...</Text>
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color={Colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptyText}>No jobs available for this location yet</Text>
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{jobs.length}</Text>
              <Text style={styles.statLabel}>Total Jobs</Text>
            </View>
          </View>

          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {jobs.map((job, index) => {
              const priorityColors = getPriorityColor(job.priority as any);
              return (
                <TouchableOpacity
                  key={job.id}
                  style={[styles.jobCard, { marginTop: index === 0 ? 0 : Spacing.md }]}
                  onPress={() =>
                    navigation.navigate('Camera', {
                      locationId: location.id,
                      locationName: location.name ?? 'Unknown Location',
                      address: location.address,
                      jobId: job.id,
                      jobTitle: job.title,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.jobContent}>
                    <View style={styles.jobHeader}>
                      <View style={styles.jobTitleRow}>
                        <View style={styles.jobIcon}>
                          <LinearGradient
                            colors={['#8B5CF6', '#7C3AED']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.iconGradient}
                          >
                            <Ionicons name="briefcase" size={20} color="white" />
                          </LinearGradient>
                        </View>
                        <View style={styles.jobInfo}>
                          <Text style={styles.jobTitle} numberOfLines={1}>
                            {job.title}
                          </Text>
                          {job.description && (
                            <Text style={styles.jobDescription} numberOfLines={2}>
                              {job.description}
                            </Text>
                          )}
                        </View>
                      </View>
                      {job.priority && (
                        <View style={[styles.priorityBadge, { backgroundColor: priorityColors.bg }]}>
                          <Text style={[styles.priorityText, { color: priorityColors.text }]}>
                            {job.priority}
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.jobFooter}>
                      {job.category && (
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryText}>{job.category}</Text>
                        </View>
                      )}
                      <View style={styles.actionButton}>
                        <Text style={styles.actionButtonText}>Record</Text>
                        <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    marginRight: Spacing.md,
    padding: Spacing.xs,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.titleLarge,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  statValue: {
    ...Typography.displayMedium,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  emptyIconContainer: {
    marginBottom: Spacing.xxl,
  },
  emptyTitle: {
    ...Typography.titleLarge,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  jobCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    ...Shadows.medium,
  },
  jobContent: {
    padding: Spacing.lg,
  },
  jobHeader: {
    marginBottom: Spacing.md,
  },
  jobTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  jobIcon: {
    marginRight: Spacing.md,
  },
  iconGradient: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    ...Typography.titleMedium,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  jobDescription: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  priorityText: {
    ...Typography.labelSmall,
    textTransform: 'capitalize',
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  categoryBadge: {
    backgroundColor: Colors.backgroundTertiary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  categoryText: {
    ...Typography.labelSmall,
    color: Colors.primary,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.backgroundTertiary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  actionButtonText: {
    ...Typography.labelLarge,
    color: Colors.primary,
  },
});
