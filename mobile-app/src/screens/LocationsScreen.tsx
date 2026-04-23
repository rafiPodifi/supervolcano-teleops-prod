/**
 * LOCATIONS SCREEN - Premium Minimal
 * Clean, restrained, elegant
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
  Platform,
  Animated,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Home, Building2, Video, MapPin, TrendingUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import type { Location } from '@/types/user.types';
import { fetchAssignedLocationsForCurrentUser } from '@/services/api';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { getFriendlyErrorCopy } from '@/utils/user-facing-error';

export default function LocationsScreen({ navigation }: any) {
  const { user, signOut } = useAuth();
  const uploadQueue = useUploadQueue();
  const { toast, showToast, hideToast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userStats, setUserStats] = useState({
    videosRecorded: 12,
    thisWeek: 3,
  });
  const previousFailedCountRef = useRef(0);
  const hasObservedFailuresRef = useRef(false);

  useEffect(() => {
    if (user) {
      loadLocations();
    }
  }, [user]);

  const loadLocations = async () => {
    try {
      const assignedLocations = await fetchAssignedLocationsForCurrentUser();
      const locs = assignedLocations.map((location) => ({
        id: location.id,
        name: location.name || 'Unnamed Location',
        address: location.address || '',
        organizationId: '',
        type: 'property' as const,
        created_at: new Date(),
        updated_at: new Date(),
      }));
      console.log('[LocationsScreen] Mapped locations:', locs.length);
      setLocations(locs);
    } catch (error: any) {
      console.error('[LocationsScreen] Error loading locations:', error);
      const friendly = getFriendlyErrorCopy(error, 'locations');
      Alert.alert(friendly.title, friendly.message);
      setLocations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLocations();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleAvatarPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Sign Out'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
          title: user?.displayName || user?.email || 'Account',
          message: user?.email && user?.displayName ? user.email : undefined,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            signOut();
          }
        }
      );
    } else {
      // Android fallback - use Alert
      Alert.alert(
        user?.displayName || 'Account',
        user?.email || '',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              signOut();
            },
          },
        ]
      );
    }
  };

  const handleLocationPress = (location: Location) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('JobSelect', { location });
  };

  const handleGenericRecordingPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('GenericRecordingHub');
  };

  const handleFailedUploadsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('FailedUploads');
  };

  useEffect(() => {
    if (!hasObservedFailuresRef.current) {
      hasObservedFailuresRef.current = true;
      previousFailedCountRef.current = uploadQueue.failed;
      return;
    }

    if (uploadQueue.failed > previousFailedCountRef.current) {
      showToast('Upload failed. Open Failed uploads to retry or delete.', 'error');
    }

    previousFailedCountRef.current = uploadQueue.failed;
  }, [showToast, uploadQueue.failed]);

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getFirstName = (): string => {
    if (user?.displayName) return user.displayName.split(' ')[0];
    if (user?.email) return user.email.split('@')[0];
    return 'there';
  };

  const getFormattedDate = (): string => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#8E8E93" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />
      <FlatList
        data={locations}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#8E8E93"
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Greeting */}
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.greeting}>{getGreeting()}</Text>
                <Text style={styles.userName}>{getFirstName()}</Text>
                <Text style={styles.dateText}>{getFormattedDate()}</Text>
              </View>
              <TouchableOpacity
                onPress={handleAvatarPress}
                activeOpacity={0.7}
                style={styles.avatarButton}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {getFirstName().charAt(0).toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Upload Status - Only show if pending */}
            {uploadQueue.total > 0 && (
              <TouchableOpacity
                style={styles.uploadStatus}
                activeOpacity={0.7}
                onPress={
                  uploadQueue.failed > 0
                    ? handleFailedUploadsPress
                    : uploadQueue.needsAssignment > 0
                    ? handleGenericRecordingPress
                    : undefined
                }
              >
                {uploadQueue.isUploading ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Ionicons
                    name={
                      uploadQueue.failed > 0
                        ? 'alert-circle'
                        : uploadQueue.needsAssignment > 0
                        ? 'time-outline'
                        : 'cloud-upload-outline'
                    }
                    size={16}
                    color={
                      uploadQueue.failed > 0
                        ? '#FF9500'
                        : uploadQueue.needsAssignment > 0
                        ? '#C2410C'
                        : '#007AFF'
                    }
                  />
                )}
                <Text style={[
                  styles.uploadStatusText,
                  (uploadQueue.failed > 0 || uploadQueue.needsAssignment > 0) &&
                    styles.uploadStatusTextWarning
                ]}>
                  {uploadQueue.failed > 0
                    ? `${uploadQueue.failed} failed • review`
                    : uploadQueue.needsAssignment > 0
                    ? `${uploadQueue.needsAssignment} need assignment`
                    : uploadQueue.isUploading
                    ? `Uploading ${uploadQueue.uploading}...`
                    : `${uploadQueue.pending} pending`}
                </Text>
              </TouchableOpacity>
            )}

            {uploadQueue.failed > 0 && (
              <TouchableOpacity
                style={styles.failedCard}
                activeOpacity={0.85}
                onPress={handleFailedUploadsPress}
              >
                <View style={styles.failedCardIcon}>
                  <Ionicons name="alert-circle-outline" size={24} color="#B45309" />
                </View>
                <View style={styles.failedCardBody}>
                  <Text style={styles.failedCardTitle}>Failed uploads</Text>
                  <Text style={styles.failedCardText}>
                    Review failed videos, retry them, or delete the ones you want to discard.
                  </Text>
                </View>
                <View style={styles.failedBadge}>
                  <Text style={styles.failedBadgeText}>{uploadQueue.failed}</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.genericCard}
              activeOpacity={0.85}
              onPress={handleGenericRecordingPress}
            >
              <View style={styles.genericCardIcon}>
                <Ionicons name="radio-outline" size={24} color="#0F766E" />
              </View>
              <View style={styles.genericCardBody}>
                <Text style={styles.genericCardTitle}>Generic recording</Text>
                <Text style={styles.genericCardText}>
                  Record now and assign location and task later from a pending queue.
                </Text>
              </View>
              {uploadQueue.needsAssignment > 0 ? (
                <View style={styles.genericBadge}>
                  <Text style={styles.genericBadgeText}>{uploadQueue.needsAssignment}</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={18} color="#0F766E" />
              )}
            </TouchableOpacity>

            {/* Stats Bar */}
            <View style={{
              flexDirection: 'row',
              backgroundColor: '#fff',
              borderRadius: 16,
              marginHorizontal: 20,
              marginBottom: 24,
              padding: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}>
              {/* Stat 1: Locations */}
              <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: '#EFF6FF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}>
                  <MapPin size={18} color="#3B82F6" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>
                  {locations.length}
                </Text>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  Locations
                </Text>
              </View>
              {/* Divider */}
              <View style={{ width: 1, backgroundColor: '#E5E7EB', marginVertical: 8 }} />
              {/* Stat 2: Videos */}
              <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: '#F0FDF4',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}>
                  <Video size={18} color="#22C55E" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>
                  {userStats.videosRecorded || 0}
                </Text>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  Recorded
                </Text>
              </View>
              {/* Divider */}
              <View style={{ width: 1, backgroundColor: '#E5E7EB', marginVertical: 8 }} />
              {/* Stat 3: This Week */}
              <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: '#FEF3C7',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}>
                  <TrendingUp size={18} color="#F59E0B" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>
                  {userStats.thisWeek || 0}
                </Text>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  This Week
                </Text>
              </View>
            </View>

            {/* Section Title */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {locations.length === 1 ? '1 Location' : `${locations.length} Locations`}
              </Text>
              <Text style={styles.sectionHint}>Tap to start recording</Text>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <LocationCard
            location={item}
            onPress={() => handleLocationPress(item)}
            index={index}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={48} color="#D1D1D6" />
            <Text style={styles.emptyTitle}>No locations yet</Text>
            <Text style={styles.emptyText}>
              Pull down to refresh
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// Location Card with staggered entrance
function LocationCard({
  location,
  onPress,
  index,
}: {
  location: Location;
  onPress: () => void;
  index: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Staggered entrance animation
  useEffect(() => {
    const delay = index * 60;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY }, { scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
        style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        {/* Left icon */}
        <View style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          backgroundColor: location.type === 'test_site' ? '#EEF2FF' : '#EFF6FF',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}>
          {location.type === 'test_site' ? (
            <Building2 size={24} color="#6366F1" />
          ) : (
            <Home size={24} color="#3B82F6" />
          )}
        </View>

        {/* Middle content */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 2 }}>
            {location.name}
          </Text>
          {location.address ? (
            <Text style={{ fontSize: 14, color: '#6B7280' }} numberOfLines={1}>
              {location.address}
            </Text>
          ) : (
            <Text style={{ fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' }}>
              No address
            </Text>
          )}
        </View>

        {/* Right camera icon */}
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: '#EFF6FF',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Video size={20} color="#3B82F6" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 2,
  },
  userName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: 14,
    color: '#C7C7CC',
    fontWeight: '500',
    marginTop: 4,
  },
  avatarButton: {
    padding: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  // Upload Status
  uploadStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 24,
  },
  uploadStatusText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#007AFF',
    marginLeft: 6,
  },
  uploadStatusTextWarning: {
    color: '#FF9500',
  },
  genericCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  genericCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  genericCardBody: {
    flex: 1,
    marginRight: 12,
  },
  genericCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#134E4A',
  },
  genericCardText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: '#0F766E',
  },
  genericBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  genericBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  failedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  failedCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  failedCardBody: {
    flex: 1,
    marginRight: 12,
  },
  failedCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9A3412',
  },
  failedCardText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: '#B45309',
  },
  failedBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  failedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Section
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  sectionHint: {
    fontSize: 13,
    color: '#C7C7CC',
    fontWeight: '400',
    marginTop: 2,
  },
  // Card
  cardContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 14,
    padding: 16,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 3,
  },
  cardAddress: {
    fontSize: 14,
    color: '#8E8E93',
  },
  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
  },
});
