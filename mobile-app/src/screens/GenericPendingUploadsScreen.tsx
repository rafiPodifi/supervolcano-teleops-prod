import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchAssignedLocationsForCurrentUser, fetchJobsForLocation } from '@/services/api';
import { useUploadQueueDebug } from '@/hooks/useUploadQueueDebug';
import type { Job, Location } from '@/types';
import { getFriendlyErrorCopy } from '@/utils/user-facing-error';

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export default function GenericPendingUploadsScreen({ navigation }: any) {
  const queue = useUploadQueueDebug();
  const pendingItems = useMemo(
    () => queue.items.filter((item) => item.status === 'needs_assignment'),
    [queue.items]
  );

  const [locations, setLocations] = useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Job[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadLocations() {
      setLocationsLoading(true);
      try {
        const assignedLocations = await fetchAssignedLocationsForCurrentUser();
        if (mounted) {
          setLocations(assignedLocations);
        }
      } catch (error: any) {
        if (mounted) {
          setLocations([]);
          const friendly = getFriendlyErrorCopy(error, 'locations');
          Alert.alert(friendly.title, friendly.message);
        }
      } finally {
        if (mounted) {
          setLocationsLoading(false);
        }
      }
    }

    void loadLocations();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedItem = pendingItems.find((item) => item.id === selectedItemId) ?? null;
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? null;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  const openAssignment = (itemId: string) => {
    setSelectedItemId(itemId);
    setSelectedLocationId(null);
    setSelectedTaskId(null);
    setTasks([]);
  };

  const closeAssignment = () => {
    if (submitting) {
      return;
    }
    setSelectedItemId(null);
    setSelectedLocationId(null);
    setSelectedTaskId(null);
    setTasks([]);
  };

  const loadTasks = async (locationId: string) => {
    setSelectedLocationId(locationId);
    setSelectedTaskId(null);
    setTasks([]);
    setTasksLoading(true);
    try {
      const nextTasks = await fetchJobsForLocation(locationId);
      setTasks(nextTasks);
    } catch (error: any) {
      const friendly = getFriendlyErrorCopy(error, 'tasks');
      Alert.alert(friendly.title, friendly.message);
    } finally {
      setTasksLoading(false);
    }
  };

  const handleDelete = (itemId: string) => {
    Alert.alert(
      'Delete recording?',
      'This will permanently remove the saved recording from the device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void queue.deleteItem(itemId);
            if (selectedItemId === itemId) {
              closeAssignment();
            }
          },
        },
      ]
    );
  };

  const handleUpload = async () => {
    if (!selectedItem || !selectedLocation || !selectedTask) {
      return;
    }

    setSubmitting(true);
    try {
      await queue.assignItem(selectedItem.id, {
        locationId: selectedLocation.id,
        locationName: selectedLocation.name || 'Unnamed Location',
        jobId: selectedTask.id,
        jobTitle: selectedTask.title,
      });
      closeAssignment();
      Alert.alert('Upload started', 'The recording has moved into the upload queue.');
    } catch (error: any) {
      const friendly = getFriendlyErrorCopy(error, 'upload');
      Alert.alert(friendly.title, friendly.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Assign Pending Uploads</Text>
          <Text style={styles.subtitle}>
            Complete location and task metadata, then start upload.
          </Text>
        </View>
      </View>

      {pendingItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-done-outline" size={44} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No pending generic recordings</Text>
          <Text style={styles.emptyBody}>
            New generic recordings will appear here until they are assigned.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {pendingItems.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTitleWrap}>
                  <Text style={styles.itemTitle}>{item.jobTitle || 'Generic recording'}</Text>
                  <Text style={styles.itemMeta}>Saved {formatDateTime(item.createdAt)}</Text>
                  <Text style={styles.itemMeta}>
                    Segment {item.segmentNumber} • waiting for assignment
                  </Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>Needs assignment</Text>
                </View>
              </View>

              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => handleDelete(item.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.secondaryButtonText}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => openAssignment(item.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>Assign and upload</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal
        visible={Boolean(selectedItem)}
        animationType="slide"
        transparent
        onRequestClose={closeAssignment}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign recording</Text>
              <TouchableOpacity onPress={closeAssignment} disabled={submitting}>
                <Ionicons name="close" size={22} color="#475569" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionTitle}>1. Choose location</Text>
              {locationsLoading ? (
                <ActivityIndicator size="small" color="#0F766E" style={styles.inlineLoader} />
              ) : locations.length === 0 ? (
                <Text style={styles.helperText}>No authorized locations are available right now.</Text>
              ) : (
                locations.map((location) => {
                  const selected = location.id === selectedLocationId;
                  return (
                    <TouchableOpacity
                      key={location.id}
                      style={[styles.optionRow, selected && styles.optionRowSelected]}
                      onPress={() => void loadTasks(location.id)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.optionText}>
                        <Text style={styles.optionTitle}>{location.name || 'Unnamed Location'}</Text>
                        <Text style={styles.optionSubtitle}>{location.address || 'No address'}</Text>
                      </View>
                      {selected && <Ionicons name="checkmark-circle" size={20} color="#0F766E" />}
                    </TouchableOpacity>
                  );
                })
              )}

              {selectedLocation && (
                <>
                  <Text style={styles.sectionTitle}>2. Choose task</Text>
                  {tasksLoading ? (
                    <ActivityIndicator size="small" color="#1D4ED8" style={styles.inlineLoader} />
                  ) : tasks.length === 0 ? (
                    <View style={styles.blockedCard}>
                      <Text style={styles.blockedTitle}>No valid tasks for this location</Text>
                      <Text style={styles.blockedBody}>
                        Upload stays blocked until this location has at least one task. Choose a different
                        location, retry later, or delete the recording.
                      </Text>
                      {selectedItem && (
                        <TouchableOpacity
                          style={styles.deleteLink}
                          onPress={() => handleDelete(selectedItem.id)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.deleteLinkText}>Delete this recording</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    tasks.map((task) => {
                      const selected = task.id === selectedTaskId;
                      return (
                        <TouchableOpacity
                          key={task.id}
                          style={[styles.optionRow, selected && styles.optionRowSelectedBlue]}
                          onPress={() => setSelectedTaskId(task.id)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.optionText}>
                            <Text style={styles.optionTitle}>{task.title}</Text>
                            <Text style={styles.optionSubtitle}>
                              {task.description || task.category || 'Task required for upload'}
                            </Text>
                          </View>
                          {selected && <Ionicons name="checkmark-circle" size={20} color="#1D4ED8" />}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.uploadButton,
                (!selectedLocation || !selectedTask || submitting) && styles.uploadButtonDisabled,
              ]}
              disabled={!selectedLocation || !selectedTask || submitting}
              onPress={() => void handleUpload()}
              activeOpacity={0.9}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.uploadButtonText}>Upload</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#6B7280',
  },
  listContent: {
    padding: 20,
    gap: 14,
  },
  itemCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemTitleWrap: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  itemMeta: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
  },
  statusPill: {
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: '#0F766E',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '86%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  optionRowSelected: {
    borderColor: '#0F766E',
    backgroundColor: '#F0FDFA',
  },
  optionRowSelectedBlue: {
    borderColor: '#1D4ED8',
    backgroundColor: '#EFF6FF',
  },
  optionText: {
    flex: 1,
    marginRight: 10,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  optionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  blockedCard: {
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    padding: 14,
  },
  blockedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#9A3412',
  },
  blockedBody: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#9A3412',
  },
  deleteLink: {
    marginTop: 12,
  },
  deleteLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B91C1C',
  },
  uploadButton: {
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: '#0F766E',
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonDisabled: {
    opacity: 0.45,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inlineLoader: {
    marginVertical: 18,
  },
});
