import React, { useMemo, useState } from 'react';
import {
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

export default function UploadQueueScreen({ navigation }: any) {
  const queue = useUploadQueueDebug();
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [showGlobalLogs, setShowGlobalLogs] = useState(false);

  const summaryText = useMemo(() => {
    if (queue.status.total === 0) {
      return 'No queued uploads';
    }

    if (queue.status.failed > 0) {
      return `${queue.status.failed} failed, ${queue.status.pending} pending`;
    }

    if (queue.status.uploading > 0) {
      return `${queue.status.uploading} uploading, ${queue.status.pending} pending`;
    }

    return `${queue.status.pending} pending`;
  }, [queue.status]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Upload Queue</Text>
          <Text style={styles.subtitle}>{summaryText}</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{queue.status.total}</Text>
          <Text style={styles.summaryLabel}>Queued</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{queue.status.uploading}</Text>
          <Text style={styles.summaryLabel}>Uploading</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{queue.status.failed}</Text>
          <Text style={styles.summaryLabel}>Failed</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={queue.retryFailed}
          activeOpacity={0.85}
        >
          <Text style={styles.actionButtonPrimaryText}>Retry failed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={queue.clearQueue}
          activeOpacity={0.85}
        >
          <Text style={styles.actionButtonSecondaryText}>Clear queue</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusPanel}>
        <Text style={styles.statusTitle}>Queue runtime</Text>
        <Text style={styles.statusLine}>Processing: {queue.isProcessing ? 'yes' : 'no'}</Text>
        <Text style={styles.statusLine}>Online: {queue.isOnline ? 'yes' : 'no'}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.globalLogsHeader}
          onPress={() => setShowGlobalLogs((value) => !value)}
          activeOpacity={0.85}
        >
          <Text style={styles.sectionTitle}>Recent service logs</Text>
          <Ionicons
            name={showGlobalLogs ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#9fb3ff"
          />
        </TouchableOpacity>

        {showGlobalLogs && (
          <View style={styles.globalLogsPanel}>
            {queue.logs.length === 0 ? (
              <Text style={styles.emptyText}>No queue logs yet.</Text>
            ) : (
              queue.logs.slice(0, 20).map((log) => (
                <View key={log.id} style={styles.logRow}>
                  <Text style={styles.logTimestamp}>{formatDateTime(log.timestamp)}</Text>
                  <Text style={[styles.logMessage, log.level === 'error' && styles.logMessageError]}>
                    {log.stage ? `[${log.stage}] ` : ''}
                    {log.message}
                  </Text>
                  {log.details ? <Text style={styles.logDetails}>{log.details}</Text> : null}
                </View>
              ))
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>Queued videos</Text>
        {queue.items.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>Nothing in the queue</Text>
            <Text style={styles.emptyText}>New recordings will appear here with stage logs.</Text>
          </View>
        ) : (
          queue.items.map((item) => {
            const expanded = expandedItemId === item.id;
            return (
              <View key={item.id} style={styles.itemCard}>
                <TouchableOpacity
                  style={styles.itemHeader}
                  onPress={() => setExpandedItemId(expanded ? null : item.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.itemHeaderText}>
                    <Text style={styles.itemTitle}>{item.jobTitle}</Text>
                    <Text style={styles.itemMeta}>
                      Segment {item.segmentNumber} • {item.status} • stage {item.stage}
                    </Text>
                    <Text style={styles.itemMeta}>Progress {item.progress}% • Retries {item.retryCount}</Text>
                    <Text style={styles.itemMeta}>Updated {formatDateTime(item.updatedAt)}</Text>
                  </View>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#c6d4ff"
                  />
                </TouchableOpacity>

                {item.lastError ? (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{item.lastError}</Text>
                  </View>
                ) : null}

                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={styles.inlineActionButton}
                    onPress={() => queue.retryItem(item.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.inlineActionText}>Retry now</Text>
                  </TouchableOpacity>
                </View>

                {expanded && (
                  <View style={styles.itemLogs}>
                    {item.logs.length === 0 ? (
                      <Text style={styles.emptyText}>No logs recorded for this item.</Text>
                    ) : (
                      item.logs.map((log) => (
                        <View key={log.id} style={styles.logRow}>
                          <Text style={styles.logTimestamp}>{formatDateTime(log.timestamp)}</Text>
                          <Text style={[styles.logMessage, log.level === 'error' && styles.logMessageError]}>
                            {log.stage ? `[${log.stage}] ` : ''}
                            {log.message}
                          </Text>
                          {log.details ? <Text style={styles.logDetails}>{log.details}</Text> : null}
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07111f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#9fb3c8',
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: '#10203a',
    borderWidth: 1,
    borderColor: '#173156',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  summaryLabel: {
    marginTop: 6,
    fontSize: 13,
    color: '#9fb3c8',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: '#2f80ff',
  },
  actionButtonSecondary: {
    backgroundColor: '#16253e',
    borderWidth: 1,
    borderColor: '#29456e',
  },
  actionButtonPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  actionButtonSecondaryText: {
    color: '#dce6ff',
    fontSize: 15,
    fontWeight: '600',
  },
  statusPanel: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#0c1a2f',
    borderWidth: 1,
    borderColor: '#163050',
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  statusLine: {
    fontSize: 13,
    color: '#a9bed6',
    marginBottom: 2,
  },
  scrollView: {
    flex: 1,
    marginTop: 12,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  globalLogsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  globalLogsPanel: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#0b182d',
    borderWidth: 1,
    borderColor: '#163050',
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dce6ff',
    marginBottom: 12,
  },
  emptyPanel: {
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#0c1a2f',
    borderWidth: 1,
    borderColor: '#163050',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#9fb3c8',
  },
  itemCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#0c1a2f',
    borderWidth: 1,
    borderColor: '#163050',
    marginBottom: 14,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  itemMeta: {
    fontSize: 12,
    color: '#9fb3c8',
    marginBottom: 4,
  },
  errorBanner: {
    marginTop: 12,
    borderRadius: 12,
    padding: 10,
    backgroundColor: 'rgba(210, 62, 87, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 103, 133, 0.35)',
  },
  errorText: {
    color: '#ffd6dd',
    fontSize: 13,
    lineHeight: 18,
  },
  itemActions: {
    flexDirection: 'row',
    marginTop: 12,
  },
  inlineActionButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#15335f',
  },
  inlineActionText: {
    color: '#dce6ff',
    fontSize: 13,
    fontWeight: '700',
  },
  itemLogs: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#173156',
    paddingTop: 12,
  },
  logRow: {
    marginBottom: 10,
  },
  logTimestamp: {
    fontSize: 11,
    color: '#6f8baa',
    marginBottom: 2,
  },
  logMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: '#dce6ff',
  },
  logMessageError: {
    color: '#ffd6dd',
  },
  logDetails: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: '#8aa3c0',
  },
});
