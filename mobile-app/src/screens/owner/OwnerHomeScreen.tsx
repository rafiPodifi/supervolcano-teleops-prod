/**
 * OWNER HOME SCREEN
 * Displays list of owner's locations with quick actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Plus, MapPin, Users, ChevronRight, Building2 } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface Location {
  id: string;
  name: string;
  address: string;
  status: 'active' | 'inactive';
  cleanerCount?: number;
  hasStructure?: boolean;
}

export default function OwnerHomeScreen() {
  const navigation = useNavigation();
  const { user, userProfile } = useAuth();
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLocations = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log('[OwnerHome] Fetching locations for:', user.uid);
      
      // Query locations owned by this user
      const locationsRef = collection(db, 'locations');
      const q = query(
        locationsRef,
        where('assignedOrganizationId', '==', `owner:${user.uid}`)
      );
      
      const snapshot = await getDocs(q);
      const locationList: Location[] = [];
      
      snapshot.forEach((doc) => {
        locationList.push({
          id: doc.id,
          ...doc.data(),
        } as Location);
      });
      
      console.log('[OwnerHome] Found locations:', locationList.length);
      setLocations(locationList);
    } catch (error) {
      console.error('[OwnerHome] Error fetching locations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLocations();
  }, [fetchLocations]);

  const renderLocation = ({ item }: { item: Location }) => (
    <TouchableOpacity
      style={styles.locationCard}
      onPress={() => navigation.navigate('LocationDetail', { locationId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.locationIcon}>
        <Building2 size={24} color="#2563EB" />
      </View>
      
      <View style={styles.locationInfo}>
        <Text style={styles.locationName}>{item.name}</Text>
        <View style={styles.locationMeta}>
          <MapPin size={14} color="#9CA3AF" />
          <Text style={styles.locationAddress} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
        {item.cleanerCount !== undefined && item.cleanerCount > 0 && (
          <View style={styles.locationMeta}>
            <Users size={14} color="#9CA3AF" />
            <Text style={styles.cleanerCount}>
              {item.cleanerCount} cleaner{item.cleanerCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.locationStatus}>
        {!item.hasStructure && (
          <View style={styles.setupBadge}>
            <Text style={styles.setupBadgeText}>Setup needed</Text>
          </View>
        )}
        <ChevronRight size={20} color="#D1D5DB" />
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <MapPin size={48} color="#9CA3AF" />
      </View>
      <Text style={styles.emptyTitle}>No locations yet</Text>
      <Text style={styles.emptySubtitle}>
        Add your first property to get started
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => navigation.navigate('AddLocation')}
      >
        <Plus size={20} color="#FFFFFF" />
        <Text style={styles.emptyButtonText}>Add Location</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View>
        <Text style={styles.greeting}>
          Hello, {userProfile?.displayName?.split(' ')[0] || 'there'}
        </Text>
        <Text style={styles.subtitle}>
          {locations.length} location{locations.length !== 1 ? 's' : ''}
        </Text>
      </View>
      
      {locations.length > 0 && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddLocation')}
        >
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading your locations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {renderHeader()}
      
      <FlatList
        data={locations}
        renderItem={renderLocation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          locations.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563EB"
          />
        }
        showsVerticalScrollIndicator={false}
      />
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  listContent: {
    padding: 16,
  },
  emptyListContent: {
    flex: 1,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  locationIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  locationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  locationAddress: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
    flex: 1,
  },
  cleanerCount: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setupBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  setupBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

