/**
 * LOCATION DETAIL SCREEN
 * View location structure and manage cleaners
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ArrowLeft, MapPin, Users, Building2, Target,
  CheckCircle, Clock, UserPlus, Settings, ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'https://your-api.vercel.app';

export default function LocationDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  
  const { locationId } = route.params as { locationId: string };
  
  const [location, setLocation] = useState<any>(null);
  const [structure, setStructure] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Fetch location
      const locationDoc = await getDoc(doc(db, 'locations', locationId));
      if (locationDoc.exists()) {
        setLocation({ id: locationDoc.id, ...locationDoc.data() });
      }

      // Fetch structure
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        console.error('[LocationDetail] No auth session');
        return;
      }
      const token = await firebaseUser.getIdToken();
      
      const url = `${process.env.EXPO_PUBLIC_API_BASE_URL || API_URL}/api/admin/locations/${locationId}/structure`;
      console.log('[LocationDetail] Fetching structure from:', url);
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Log raw response for debugging
      const responseText = await response.text();
      console.log('[LocationDetail] Response status:', response.status);
      console.log('[LocationDetail] Response text:', responseText.substring(0, 200));
      
      if (!response.ok) {
        console.error('[LocationDetail] API error:', response.status, responseText.substring(0, 100));
        return;
      }
      
      const data = JSON.parse(responseText);
      if (data.floors) {
        console.log('[LocationDetail] Loaded structure with', data.floors.length, 'floors');
        setStructure(data.floors);
      }
    } catch (error) {
      console.error('[LocationDetail] Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [locationId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Calculate stats
  const getStats = () => {
    if (!structure) return { floors: 0, rooms: 0, targets: 0, actions: 0, minutes: 0 };
    
    let rooms = 0, targets = 0, actions = 0, minutes = 0;
    structure.forEach((floor: any) => {
      rooms += floor.rooms?.length || 0;
      floor.rooms?.forEach((room: any) => {
        targets += room.targets?.length || 0;
        room.targets?.forEach((target: any) => {
          actions += target.actions?.length || 0;
          target.actions?.forEach((action: any) => {
            minutes += action.durationMinutes || 0;
          });
        });
      });
    });
    
    return { floors: structure.length, rooms, targets, actions, minutes };
  };

  const stats = getStats();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {location?.name}
          </Text>
          <View style={styles.headerAddress}>
            <MapPin size={12} color="#9CA3AF" />
            <Text style={styles.headerAddressText} numberOfLines={1}>
              {location?.address}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.settingsButton}>
          <Settings size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563EB"
          />
        }
      >
        {/* Stats cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Building2 size={24} color="#2563EB" />
            <Text style={styles.statNumber}>{stats.floors}</Text>
            <Text style={styles.statLabel}>Floors</Text>
          </View>
          <View style={styles.statCard}>
            <Target size={24} color="#8B5CF6" />
            <Text style={styles.statNumber}>{stats.targets}</Text>
            <Text style={styles.statLabel}>Targets</Text>
          </View>
          <View style={styles.statCard}>
            <CheckCircle size={24} color="#10B981" />
            <Text style={styles.statNumber}>{stats.actions}</Text>
            <Text style={styles.statLabel}>Actions</Text>
          </View>
          <View style={styles.statCard}>
            <Clock size={24} color="#F59E0B" />
            <Text style={styles.statNumber}>~{stats.minutes}</Text>
            <Text style={styles.statLabel}>Minutes</Text>
          </View>
        </View>

        {/* Cleaners section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cleaners</Text>
          </View>
          
          <TouchableOpacity
            style={styles.inviteCard}
            onPress={() => navigation.navigate('InviteCleaner', {
              locationId,
              locationName: location?.name,
            })}
          >
            <View style={styles.inviteIconContainer}>
              <UserPlus size={24} color="#2563EB" />
            </View>
            <View style={styles.inviteInfo}>
              <Text style={styles.inviteTitle}>Invite a Cleaner</Text>
              <Text style={styles.inviteSubtitle}>
                Share a link to assign someone to this location
              </Text>
            </View>
            <ChevronRight size={20} color="#D1D5DB" />
          </TouchableOpacity>
        </View>

        {/* Structure preview */}
        {structure && structure.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Structure</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('LocationWizard', {
                  locationId,
                  locationName: location?.name,
                })}
              >
                <Text style={styles.sectionAction}>Edit</Text>
              </TouchableOpacity>
            </View>

            {structure.map((floor: any) => (
              <View key={floor.id} style={styles.floorCard}>
                <Text style={styles.floorName}>{floor.name}</Text>
                <View style={styles.roomList}>
                  {floor.rooms?.map((room: any) => (
                    <View key={room.id} style={styles.roomItem}>
                      <Text style={styles.roomIcon}>{room.icon || '📦'}</Text>
                      <Text style={styles.roomName}>{room.name}</Text>
                      <Text style={styles.roomTargets}>
                        {room.targets?.length || 0} targets
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* No structure - prompt to set up */}
        {(!structure || structure.length === 0) && (
          <View style={styles.emptyStructure}>
            <Building2 size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No structure configured</Text>
            <Text style={styles.emptySubtitle}>
              Set up rooms and cleaning targets
            </Text>
            <TouchableOpacity
              style={styles.setupButton}
              onPress={() => navigation.navigate('LocationWizard', {
                locationId,
                locationName: location?.name,
              })}
            >
              <Text style={styles.setupButtonText}>Run Setup Wizard</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  headerAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerAddressText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  sectionAction: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  inviteIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  inviteInfo: {
    flex: 1,
  },
  inviteTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  inviteSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  floorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  floorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  roomList: {
    gap: 8,
  },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  roomIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  roomName: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  roomTargets: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyStructure: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 20,
  },
  setupButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  setupButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

