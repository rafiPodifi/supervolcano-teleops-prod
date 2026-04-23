import React, { useMemo } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUploadQueueDebug } from '@/hooks/useUploadQueueDebug';

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export default function FailedUploadsScreen({ navigation }: any) {
  const queue = useUploadQueueDebug();
  const failedItems = useMemo(
    () => queue.items.filter((item) => item.status === 'failed'),
    [queue.items]
  );

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete failed upload?',
      'This removes the saved video from the device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void queue.deleteItem(id);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Failed uploads</Text>
          <Text style={styles.subtitle}>
            Retry videos that failed to upload or delete the ones you want to discard.
          </Text>
        </View>
      </View>

      {failedItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-done-outline" size={44} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No failed uploads</Text>
          <Text style={styles.emptyBody}>
            When an upload fails, it will appear here so it can be retried or removed.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.actionRow}>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillText}>
                {failedItems.length} failed video{failedItems.length === 1 ? '' : 's'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.retryAllButton}
              onPress={queue.retryFailed}
              activeOpacity={0.85}
            >
              <Text style={styles.retryAllButtonText}>Retry all</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {failedItems.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle}>{item.jobTitle || 'Video upload'}</Text>
                    <Text style={styles.cardSubtitle}>
                      {item.locationName || 'Assigned location'}
                    </Text>
                  </View>
                  <View style={styles.failedBadge}>
                    <Text style={styles.failedBadgeText}>Failed</Text>
                  </View>
                </View>

                <Text style={styles.cardMeta}>Last attempt {formatDateTime(item.updatedAt)}</Text>
                <Text style={styles.cardMeta}>
                  Segment {item.segmentNumber} • Retry count {item.retryCount}
                </Text>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => handleDelete(item.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.secondaryButtonText}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => queue.retryItem(item.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryButtonText}>Retry upload</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}
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
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  summaryPill: {
    borderRadius: 999,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  summaryPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9A3412',
  },
  retryAllButton: {
    borderRadius: 12,
    backgroundColor: '#EA580C',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryAllButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    gap: 14,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748B',
  },
  failedBadge: {
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  failedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  cardMeta: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: '#EA580C',
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
});
