import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUploadQueue } from '@/hooks/useUploadQueue';

export default function GenericRecordingHubScreen({ navigation }: any) {
  const uploadQueue = useUploadQueue();

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
          <Text style={styles.title}>Generic Recording</Text>
          <Text style={styles.subtitle}>
            Record first, assign location and task later.
          </Text>
        </View>
      </View>

      {uploadQueue.needsAssignment > 0 && (
        <View style={styles.noticeCard}>
          <Ionicons name="time-outline" size={18} color="#9A3412" />
          <Text style={styles.noticeText}>
            {uploadQueue.needsAssignment} recording
            {uploadQueue.needsAssignment === 1 ? '' : 's'} still need assignment.
          </Text>
        </View>
      )}

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.primaryCard}
          onPress={() => navigation.navigate('GenericPendingUploads')}
          activeOpacity={0.9}
        >
          <View style={styles.cardIcon}>
            <Ionicons name="cloud-upload-outline" size={28} color="#0F766E" />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Assign pending uploads</Text>
            <Text style={styles.cardBody}>
              Choose a location and task for each saved recording before uploading.
            </Text>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.countBadge}>{uploadQueue.needsAssignment}</Text>
            <Ionicons name="chevron-forward" size={18} color="#0F766E" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryCard}
          onPress={() => navigation.navigate('Camera', { genericRecording: true })}
          activeOpacity={0.9}
        >
          <View style={styles.cardIcon}>
            <Ionicons name="videocam-outline" size={28} color="#1D4ED8" />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Do a recording</Text>
            <Text style={styles.cardBody}>
              Start capture immediately without choosing a location or task first.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#1D4ED8" />
        </TouchableOpacity>
      </View>
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
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FFEDD5',
    gap: 8,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    color: '#9A3412',
    fontWeight: '600',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  primaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  secondaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  cardBody: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
  },
  cardMeta: {
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#0F766E',
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
});
