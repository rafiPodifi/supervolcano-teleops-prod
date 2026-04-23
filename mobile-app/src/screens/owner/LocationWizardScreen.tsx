/**
 * LOCATION WIZARD SCREEN
 * Mobile-optimized setup wizard with swipe navigation
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { 
  X, Building2, LayoutGrid, Target, CheckCircle,
  ChevronRight, ChevronLeft, Plus, Minus
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../config/firebase';
import { ROOM_TEMPLATES, getRoomTemplate } from '../../lib/templates/location-templates';
import { getFriendlyErrorCopy } from '@/utils/user-facing-error';
import Constants from 'expo-constants';

type WizardStep = 'floors' | 'rooms' | 'targets' | 'review';

interface FloorData {
  id: string;
  name: string;
  sortOrder: number;
  rooms: RoomData[];
}

interface RoomData {
  id: string;
  name: string;
  type: string;
  icon: string;
  sortOrder: number;
  targets: TargetData[];
}

interface TargetData {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  actions: ActionData[];
}

interface ActionData {
  id: string;
  name: string;
  durationMinutes: number;
  sortOrder: number;
  tools: string[];
  instructions: string;
}

const API_URL = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'https://your-api.vercel.app';

export default function LocationWizardScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  
  const { locationId, locationName } = route.params as {
    locationId: string;
    locationName: string;
  };

  const [currentStep, setCurrentStep] = useState<WizardStep>('floors');
  const [floors, setFloors] = useState<FloorData[]>([]);
  const [floorCount, setFloorCount] = useState(1);
  const [saving, setSaving] = useState(false);

  // Generate unique ID
  const generateId = () => Math.random().toString(36).substring(2, 15);

  // Initialize floors when count changes
  const initializeFloors = useCallback((count: number) => {
    const newFloors: FloorData[] = [];
    for (let i = 0; i < count; i++) {
      const existing = floors[i];
      newFloors.push(existing || {
        id: generateId(),
        name: count === 1 ? 'Main Floor' : `Floor ${i + 1}`,
        sortOrder: i,
        rooms: [],
      });
    }
    setFloors(newFloors);
  }, [floors]);

  // Add room to floor
  const addRoom = (floorIndex: number, roomType: string) => {
    const template = getRoomTemplate(roomType);
    if (!template) return;

    const newRoom: RoomData = {
      id: generateId(),
      name: template.name,
      type: roomType,
      icon: template.icon,
      sortOrder: floors[floorIndex].rooms.length,
      targets: template.defaultTargets.map((t, i) => ({
        id: generateId(),
        name: t.name,
        icon: t.icon,
        sortOrder: i,
        actions: t.defaultActions.map((a, j) => ({
          id: generateId(),
          name: a.name,
          durationMinutes: a.defaultDurationMinutes,
          sortOrder: j,
          tools: a.toolsRequired || [],
          instructions: a.instructions || '',
        })),
      })),
    };

    const newFloors = [...floors];
    newFloors[floorIndex].rooms.push(newRoom);
    setFloors(newFloors);
  };

  // Remove room
  const removeRoom = (floorIndex: number, roomIndex: number) => {
    const newFloors = [...floors];
    newFloors[floorIndex].rooms.splice(roomIndex, 1);
    setFloors(newFloors);
  };

  // Calculate stats
  const getStats = () => {
    let rooms = 0;
    let targets = 0;
    let actions = 0;
    let minutes = 0;

    floors.forEach(floor => {
      rooms += floor.rooms.length;
      floor.rooms.forEach(room => {
        targets += room.targets.length;
        room.targets.forEach(target => {
          actions += target.actions.length;
          target.actions.forEach(action => {
            minutes += action.durationMinutes;
          });
        });
      });
    });

    return { floors: floors.length, rooms, targets, actions, minutes };
  };

  // Save to API
  const handleSave = async () => {
    setSaving(true);
    
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error('Not authenticated');
      }
      const token = await firebaseUser.getIdToken();
      
      const url = `${process.env.EXPO_PUBLIC_API_BASE_URL || API_URL}/api/admin/locations/${locationId}/structure`;
      console.log('[Wizard] Saving to:', url);
      console.log('[Wizard] Floors:', floors.length);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ floors }),
      });
      
      // Log raw response for debugging
      const responseText = await response.text();
      console.log('[Wizard] Response status:', response.status);
      console.log('[Wizard] Response text:', responseText.substring(0, 200));
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} - ${responseText.substring(0, 100)}`);
      }

      const data = JSON.parse(responseText);
      console.log('[Wizard] Structure saved successfully');
      
      // Navigate to location detail
      navigation.replace('LocationDetail', { locationId });
      
    } catch (error) {
      console.error('[Wizard] Save error:', error);
      const friendly = getFriendlyErrorCopy(error, 'location_save');
      Alert.alert(friendly.title, friendly.message);
    } finally {
      setSaving(false);
    }
  };

  // Navigate steps
  const goToNextStep = () => {
    const steps: WizardStep[] = ['floors', 'rooms', 'targets', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      if (currentStep === 'floors') {
        initializeFloors(floorCount);
      }
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const goToPreviousStep = () => {
    const steps: WizardStep[] = ['floors', 'rooms', 'targets', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  // Room type chips
  const ROOM_TYPES = [
    { type: 'kitchen', icon: '🍳', name: 'Kitchen' },
    { type: 'bathroom', icon: '🚿', name: 'Bathroom' },
    { type: 'bedroom', icon: '🛏️', name: 'Bedroom' },
    { type: 'living_room', icon: '🛋️', name: 'Living Room' },
    { type: 'dining_room', icon: '🍽️', name: 'Dining Room' },
    { type: 'office', icon: '💼', name: 'Office' },
    { type: 'laundry', icon: '🧺', name: 'Laundry' },
    { type: 'garage', icon: '🚗', name: 'Garage' },
    { type: 'patio', icon: '🌿', name: 'Patio' },
    { type: 'entry', icon: '🚪', name: 'Entry' },
  ];

  // Render floor step
  const renderFloorStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconContainer}>
          <Building2 size={32} color="#2563EB" />
        </View>
        <Text style={styles.stepTitle}>How many floors?</Text>
        <Text style={styles.stepSubtitle}>
          This helps organize rooms by level
        </Text>
      </View>

      <View style={styles.floorSelector}>
        {[1, 2, 3].map(num => (
          <TouchableOpacity
            key={num}
            style={[
              styles.floorOption,
              floorCount === num && styles.floorOptionSelected,
            ]}
            onPress={() => setFloorCount(num)}
          >
            <Text style={[
              styles.floorOptionNumber,
              floorCount === num && styles.floorOptionNumberSelected,
            ]}>
              {num}
            </Text>
            <Text style={[
              styles.floorOptionLabel,
              floorCount === num && styles.floorOptionLabelSelected,
            ]}>
              {num === 1 ? 'floor' : 'floors'}
            </Text>
          </TouchableOpacity>
        ))}
        
        <View style={styles.floorOptionCustom}>
          <TouchableOpacity
            style={styles.floorAdjustButton}
            onPress={() => setFloorCount(Math.max(1, floorCount - 1))}
          >
            <Minus size={20} color="#6B7280" />
          </TouchableOpacity>
          <View style={styles.floorCustomValue}>
            <Text style={styles.floorCustomNumber}>{floorCount > 3 ? floorCount : '4+'}</Text>
          </View>
          <TouchableOpacity
            style={styles.floorAdjustButton}
            onPress={() => setFloorCount(floorCount + 1)}
          >
            <Plus size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Render rooms step
  const renderRoomsStep = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconContainer}>
          <LayoutGrid size={32} color="#2563EB" />
        </View>
        <Text style={styles.stepTitle}>Add rooms</Text>
        <Text style={styles.stepSubtitle}>
          Tap room types to add them
        </Text>
      </View>

      {floors.map((floor, floorIndex) => (
        <View key={floor.id} style={styles.floorSection}>
          {floors.length > 1 && (
            <Text style={styles.floorSectionTitle}>{floor.name}</Text>
          )}
          
          {/* Room type grid */}
          <View style={styles.roomTypeGrid}>
            {ROOM_TYPES.map(room => (
              <TouchableOpacity
                key={room.type}
                style={styles.roomTypeChip}
                onPress={() => addRoom(floorIndex, room.type)}
              >
                <Text style={styles.roomTypeIcon}>{room.icon}</Text>
                <Text style={styles.roomTypeName}>{room.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Added rooms */}
          {floor.rooms.length > 0 && (
            <View style={styles.addedRooms}>
              <Text style={styles.addedRoomsTitle}>
                Added ({floor.rooms.length})
              </Text>
              {floor.rooms.map((room, roomIndex) => (
                <View key={room.id} style={styles.addedRoomItem}>
                  <Text style={styles.addedRoomIcon}>{room.icon}</Text>
                  <Text style={styles.addedRoomName}>{room.name}</Text>
                  <Text style={styles.addedRoomTargets}>
                    {room.targets.length} targets
                  </Text>
                  <TouchableOpacity
                    onPress={() => removeRoom(floorIndex, roomIndex)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );

  // Render targets step (simplified - shows summary)
  const renderTargetsStep = () => {
    const stats = getStats();
    
    return (
      <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
        <View style={styles.stepHeader}>
          <View style={styles.stepIconContainer}>
            <Target size={32} color="#2563EB" />
          </View>
          <Text style={styles.stepTitle}>Review targets</Text>
          <Text style={styles.stepSubtitle}>
            Each room has pre-configured targets and actions
          </Text>
        </View>

        {floors.map(floor => (
          <View key={floor.id} style={styles.targetFloorSection}>
            {floors.length > 1 && (
              <Text style={styles.targetFloorTitle}>{floor.name}</Text>
            )}
            
            {floor.rooms.map(room => (
              <View key={room.id} style={styles.targetRoomCard}>
                <View style={styles.targetRoomHeader}>
                  <Text style={styles.targetRoomIcon}>{room.icon}</Text>
                  <Text style={styles.targetRoomName}>{room.name}</Text>
                  <Text style={styles.targetRoomCount}>
                    {room.targets.length} targets
                  </Text>
                </View>
                
                <View style={styles.targetList}>
                  {room.targets.map(target => (
                    <View key={target.id} style={styles.targetItem}>
                      <View style={styles.targetDot} />
                      <Text style={styles.targetName}>{target.name}</Text>
                      <Text style={styles.targetActionCount}>
                        {target.actions.length} actions
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    );
  };

  // Render review step
  const renderReviewStep = () => {
    const stats = getStats();
    
    return (
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepIconContainer, styles.stepIconContainerSuccess]}>
            <CheckCircle size={32} color="#10B981" />
          </View>
          <Text style={styles.stepTitle}>Ready to save!</Text>
          <Text style={styles.stepSubtitle}>
            Review your configuration below
          </Text>
        </View>

        <View style={styles.reviewStats}>
          <View style={styles.reviewStatItem}>
            <Text style={styles.reviewStatNumber}>{stats.floors}</Text>
            <Text style={styles.reviewStatLabel}>
              Floor{stats.floors !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.reviewStatItem}>
            <Text style={styles.reviewStatNumber}>{stats.rooms}</Text>
            <Text style={styles.reviewStatLabel}>
              Room{stats.rooms !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.reviewStatItem}>
            <Text style={styles.reviewStatNumber}>{stats.targets}</Text>
            <Text style={styles.reviewStatLabel}>
              Target{stats.targets !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.reviewStatItem}>
            <Text style={styles.reviewStatNumber}>~{stats.minutes}</Text>
            <Text style={styles.reviewStatLabel}>Minutes</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Complete Setup</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Progress indicator
  const STEPS: WizardStep[] = ['floors', 'rooms', 'targets', 'review'];
  const currentStepIndex = STEPS.indexOf(currentStep);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            Alert.alert(
              'Exit Setup?',
              'Your progress will be lost.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Exit', style: 'destructive', onPress: () => navigation.goBack() },
              ]
            );
          }}
        >
          <X size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {locationName}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        {STEPS.map((step, index) => (
          <View key={step} style={styles.progressSegment}>
            <View
              style={[
                styles.progressFill,
                index <= currentStepIndex && styles.progressFillActive,
              ]}
            />
          </View>
        ))}
      </View>

      {/* Step content */}
      <View style={styles.contentContainer}>
        {currentStep === 'floors' && renderFloorStep()}
        {currentStep === 'rooms' && renderRoomsStep()}
        {currentStep === 'targets' && renderTargetsStep()}
        {currentStep === 'review' && renderReviewStep()}
      </View>

      {/* Footer navigation */}
      {currentStep !== 'review' && (
        <View style={styles.footer}>
          {currentStepIndex > 0 ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={goToPreviousStep}
            >
              <ChevronLeft size={20} color="#374151" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          <TouchableOpacity
            style={[
              styles.nextButton,
              currentStep === 'rooms' && floors.every(f => f.rooms.length === 0) && styles.nextButtonDisabled,
            ]}
            onPress={goToNextStep}
            disabled={currentStep === 'rooms' && floors.every(f => f.rooms.length === 0)}
          >
            <Text style={styles.nextButtonText}>Continue</Text>
            <ChevronRight size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Stats bar */}
      {currentStep !== 'floors' && currentStep !== 'review' && (
        <View style={styles.statsBar}>
          <Text style={styles.statsText}>
            {getStats().rooms} rooms · {getStats().targets} targets · ~{getStats().minutes} min
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  progressBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  progressFillActive: {
    backgroundColor: '#2563EB',
  },
  contentContainer: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    padding: 20,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  stepIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepIconContainerSuccess: {
    backgroundColor: '#D1FAE5',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
  floorSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  floorOption: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  floorOptionSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  floorOptionNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#374151',
  },
  floorOptionNumberSelected: {
    color: '#2563EB',
  },
  floorOptionLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  floorOptionLabelSelected: {
    color: '#2563EB',
  },
  floorOptionCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floorAdjustButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  floorCustomValue: {
    width: 60,
    alignItems: 'center',
  },
  floorCustomNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
  },
  floorSection: {
    marginBottom: 24,
  },
  floorSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  roomTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  roomTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  roomTypeIcon: {
    fontSize: 18,
  },
  roomTypeName: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  addedRooms: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  addedRoomsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addedRoomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  addedRoomIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  addedRoomName: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  addedRoomTargets: {
    fontSize: 13,
    color: '#6B7280',
    marginRight: 12,
  },
  targetFloorSection: {
    marginBottom: 20,
  },
  targetFloorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  targetRoomCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  targetRoomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  targetRoomIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  targetRoomName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  targetRoomCount: {
    fontSize: 13,
    color: '#6B7280',
  },
  targetList: {
    gap: 8,
  },
  targetItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
    marginRight: 10,
  },
  targetName: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  targetActionCount: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  reviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  reviewStatItem: {
    alignItems: 'center',
  },
  reviewStatNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2563EB',
  },
  reviewStatLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#6EE7B7',
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 4,
  },
  nextButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  nextButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statsBar: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 13,
    color: '#6B7280',
  },
});
