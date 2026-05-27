/**
 * JOB SELECT SCREEN
 * Cleaners pick a job for the chosen location, then enter the recording flow.
 * Style mirrors LocationsScreen — iOS-leaning, bold heading, soft white cards,
 * staggered card entrance, blue accent.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  StatusBar,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Briefcase, ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { fetchJobsForLocation } from "../services/api";
import { Job, Location } from "../types";
import { getFriendlyErrorCopy } from "@/utils/user-facing-error";

export default function JobSelectScreen({ route, navigation }: any) {
  const { location } = route.params as { location: Location };
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      setLoading(true);
      const jobsList = await fetchJobsForLocation(location.id);
      setJobs(jobsList);
    } catch (error) {
      const friendly = getFriendlyErrorCopy(error, "tasks");
      Alert.alert(friendly.title, friendly.message);
    } finally {
      setLoading(false);
    }
  }

  const handleJobPress = (job: Job) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Camera", {
      locationId: location.id,
      locationName: location.name ?? "Unknown Location",
      address: location.address,
      jobId: job.id,
      jobTitle: job.title,
    });
  };

  const getPriorityColors = (priority?: string) => {
    switch (priority) {
      case "high":
        return { bg: "#FEF2F2", text: "#B91C1C", dot: "#EF4444" };
      case "medium":
        return { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" };
      default:
        return { bg: "#F0FDF4", text: "#166534", dot: "#22C55E" };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#8E8E93" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backButton}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="chevron-back" size={26} color="#000" />
              </TouchableOpacity>
            </View>
            <Text style={styles.eyebrow}>Select a job</Text>
            <Text style={styles.locationName} numberOfLines={2}>
              {location.name}
            </Text>
            {location.address ? (
              <Text style={styles.locationAddress} numberOfLines={1}>
                {location.address}
              </Text>
            ) : (
              <View style={styles.addressSpacer} />
            )}

            {jobs.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {jobs.length === 1 ? "1 job" : `${jobs.length} jobs`}
                </Text>
                <Text style={styles.sectionHint}>Tap to start recording</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <JobCard
            job={item}
            index={index}
            onPress={() => handleJobPress(item)}
            priorityColors={getPriorityColors((item as any).priority)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="checkmark-circle-outline"
              size={48}
              color="#D1D1D6"
            />
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptyText}>
              No jobs available for this location yet
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// Job Card with staggered entrance + press scale.
function JobCard({
  job,
  index,
  onPress,
  priorityColors,
}: {
  job: Job;
  index: number;
  onPress: () => void;
  priorityColors: { bg: string; text: string; dot: string };
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
        activeOpacity={0.85}
        style={styles.card}
      >
        <View style={styles.cardIcon}>
          <Briefcase size={22} color="#3B82F6" />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {job.title}
            </Text>
            {(job as any).priority ? (
              <View
                style={[
                  styles.priorityPill,
                  { backgroundColor: priorityColors.bg },
                ]}
              >
                <View
                  style={[
                    styles.priorityDot,
                    { backgroundColor: priorityColors.dot },
                  ]}
                />
                <Text
                  style={[styles.priorityText, { color: priorityColors.text }]}
                >
                  {(job as any).priority}
                </Text>
              </View>
            ) : null}
          </View>

          {job.description ? (
            <Text style={styles.cardDescription} numberOfLines={2}>
              {job.description}
            </Text>
          ) : null}

          {job.category ? (
            <Text style={styles.categoryText} numberOfLines={1}>
              {job.category}
            </Text>
          ) : null}
        </View>

        <View style={styles.cardChevron}>
          <ChevronRight size={18} color="#3B82F6" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  backButton: {
    marginLeft: -8,
    padding: 4,
  },
  eyebrow: {
    fontSize: 15,
    color: "#8E8E93",
    fontWeight: "500",
    marginBottom: 4,
  },
  locationName: {
    fontSize: 32,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    color: "#C7C7CC",
    fontWeight: "500",
    marginBottom: 24,
  },
  addressSpacer: {
    height: 24,
  },
  // Section
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
  },
  sectionHint: {
    fontSize: 13,
    color: "#C7C7CC",
    fontWeight: "400",
    marginTop: 2,
  },
  // Card
  cardContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
    marginRight: 8,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  cardDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 19,
  },
  priorityPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 5,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
    letterSpacing: 0.3,
  },
  categoryText: {
    marginTop: 6,
    fontSize: 11,
    color: "#3B82F6",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  cardChevron: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
    marginTop: 16,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
  },
});
