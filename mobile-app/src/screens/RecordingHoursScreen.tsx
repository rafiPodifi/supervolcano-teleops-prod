/**
 * RECORDING HOURS SCREEN
 * Cleaner self-view: how many hours of video this cleaner has recorded.
 * Backed by GET /api/mobile/recording-hours (token-verified, Admin SDK read).
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAuth } from "firebase/auth";
import { getApiBaseUrl } from "@/services/api-base";

type RangeKey = "all" | "7d" | "30d";

interface RecordingStats {
  totalHours: number;
  videoCount: number;
  lastRecordedAt: string | null;
}

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "all", label: "All time", days: null },
  { key: "30d", label: "30 days", days: 30 },
  { key: "7d", label: "7 days", days: 7 },
];

export default function RecordingHoursScreen({ navigation }: any) {
  const [range, setRange] = useState<RangeKey>("all");
  const [stats, setStats] = useState<RecordingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (selected: RangeKey) => {
    setLoading(true);
    setError(null);
    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) {
        throw new Error("Not signed in");
      }
      const token = await currentUser.getIdToken();

      const days = RANGES.find((r) => r.key === selected)?.days ?? null;
      const params = new URLSearchParams();
      if (days != null) {
        const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        params.set("from", from.toISOString());
      }
      const query = params.toString() ? `?${params.toString()}` : "";

      const response = await fetch(
        `${getApiBaseUrl()}/api/mobile/recording-hours${query}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.error || `Request returned ${response.status}`);
      }
      setStats({
        totalHours: data.stats?.totalHours ?? 0,
        videoCount: data.stats?.videoCount ?? 0,
        lastRecordedAt: data.stats?.lastRecordedAt ?? null,
      });
    } catch (e: any) {
      // Avoid the words fetch/network here — they'd be misclassified as a
      // connectivity error by the shared error copy.
      setError(e?.message || "Could not load recording hours");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const lastRecorded = stats?.lastRecordedAt
    ? new Date(stats.lastRecordedAt).toLocaleDateString()
    : "—";

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
          <Text style={styles.title}>My Recording Hours</Text>
          <Text style={styles.subtitle}>Total time you have recorded.</Text>
        </View>
      </View>

      <View style={styles.rangeRow}>
        {RANGES.map((r) => (
          <TouchableOpacity
            key={r.key}
            style={[
              styles.rangeChip,
              range === r.key && styles.rangeChipActive,
            ]}
            onPress={() => setRange(r.key)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.rangeChipText,
                range === r.key && styles.rangeChipTextActive,
              ]}
            >
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#1D4ED8" />
        ) : error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={20} color="#9A3412" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroValue}>
                {(stats?.totalHours ?? 0).toFixed(1)}
              </Text>
              <Text style={styles.heroLabel}>hours recorded</Text>
            </View>

            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats?.videoCount ?? 0}</Text>
                <Text style={styles.statLabel}>Segments</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{lastRecorded}</Text>
                <Text style={styles.statLabel}>Last recording</Text>
              </View>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerText: { flex: 1 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  subtitle: { marginTop: 4, fontSize: 14, color: "#6B7280" },
  rangeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  rangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  rangeChipActive: { backgroundColor: "#1D4ED8", borderColor: "#1D4ED8" },
  rangeChipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  rangeChipTextActive: { color: "#FFFFFF" },
  content: { padding: 20, gap: 16 },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  heroValue: { fontSize: 56, fontWeight: "800", color: "#1D4ED8" },
  heroLabel: { marginTop: 4, fontSize: 15, color: "#6B7280" },
  statRow: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statValue: { fontSize: 20, fontWeight: "700", color: "#111827" },
  statLabel: { marginTop: 4, fontSize: 13, color: "#6B7280" },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#FFEDD5",
  },
  errorText: { flex: 1, fontSize: 14, color: "#9A3412", fontWeight: "600" },
});
