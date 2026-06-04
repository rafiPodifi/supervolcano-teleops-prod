/**
 * LOCATIONS SCREEN - Premium Minimal
 * Cleaner home: nearest 2 assigned locations (GPS) + pinned "Other Locations"
 * CTA. Cache-first data + last-known coords for instant render; precise fix
 * refines in the background. Never auto-prompts for location permission —
 * the "Enable" placeholder button does.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
  Platform,
  ActionSheetIOS,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Video, MapPin, TrendingUp } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useUploadQueue } from "@/hooks/useUploadQueue";
import type { Location } from "@/types";
import {
  getAssignedLocationsCacheFirst,
  refreshAssignedLocationsInBackground,
} from "@/services/api";
import {
  locationService,
  nearestAssignedLocations,
  formatDistance,
} from "@/services/location.service";
import { LocationCard } from "@/components/LocationCard";
import { Toast } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { getFriendlyErrorCopy } from "@/utils/user-facing-error";

const NEARBY_COUNT = 2;

// "denied" = permission not granted (show Enable CTA). "unavailable" =
// permission granted but no usable fix/coords yet (show loading copy only —
// never the Enable CTA).
type GpsState = "resolving" | "ready" | "denied" | "unavailable";

export default function LocationsScreen({ navigation }: any) {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const uploadQueue = useUploadQueue();
  const { toast, showToast, hideToast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [nearest, setNearest] = useState<
    { location: Location; distanceM: number }[]
  >([]);
  const [gpsState, setGpsState] = useState<GpsState>("resolving");
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userStats, setUserStats] = useState({
    videosRecorded: 12,
    thisWeek: 3,
  });
  const previousFailedCountRef = useRef(0);
  const hasObservedFailuresRef = useRef(false);

  /**
   * Load assigned locations: cache-first for instant render, network refresh
   * when stale/empty/forced. Never throws past the friendly alert.
   */
  const loadLocations = useCallback(
    async (forceNetwork: boolean): Promise<Location[]> => {
      try {
        const cache = await getAssignedLocationsCacheFirst();
        let list = cache.locations;
        if (list.length > 0) {
          setLocations(list);
          setLoading(false);
        }
        if (forceNetwork || cache.stale || list.length === 0) {
          setFetching(true);
          try {
            list = await refreshAssignedLocationsInBackground();
            setLocations(list);
          } finally {
            setFetching(false);
          }
        }
        return list;
      } catch (error: any) {
        console.error("[LocationsScreen] Error loading locations:", error);
        const friendly = getFriendlyErrorCopy(error, "locations");
        Alert.alert(friendly.title, friendly.message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Compute the nearest cards. Fast path: last-known OS fix → instant; then a
   * precise fix refines in the background (only when permission is already
   * granted — no prompt).
   */
  const resolveNearby = useCallback(async (list: Location[]) => {
    if (list.length === 0) {
      setNearest([]);
      setGpsState("ready");
      return;
    }

    const granted = await locationService.hasPermission();
    if (!granted) {
      setNearest([]);
      setGpsState("denied");
      return;
    }

    const lastKnown = await locationService.getLastKnownCoordinates();
    if (lastKnown) {
      const quick = nearestAssignedLocations(lastKnown, list, NEARBY_COUNT);
      setNearest(quick);
      setGpsState(quick.length > 0 ? "ready" : "unavailable");
    }

    // Precise fix (permission already granted → no prompt)
    const fresh = await locationService.getCurrentCoordinates();
    const coords = fresh ?? lastKnown;
    if (!coords) {
      setGpsState((prev) => (prev === "ready" ? prev : "unavailable"));
      return;
    }
    const refined = nearestAssignedLocations(coords, list, NEARBY_COUNT);
    setNearest(refined);
    setGpsState(refined.length > 0 ? "ready" : "unavailable");
  }, []);

  // Recompute on every focus (e.g. returning from Camera) — cache + last-known
  // fix make this instant; nothing blocks the UI.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      (async () => {
        const list = await loadLocations(false);
        await resolveNearby(list);
      })();
    }, [user, loadLocations, resolveNearby]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const list = await loadLocations(true);
      await resolveNearby(list);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setRefreshing(false);
    }
  };

  const handleEnableLocation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGpsState("resolving");
    const granted = await locationService.requestPermission();
    if (!granted) {
      setGpsState("denied");
      return;
    }
    await resolveNearby(locations);
  };

  const handleAvatarPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Sign Out"],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
          title: user?.displayName || user?.email || "Account",
          message: user?.email && user?.displayName ? user.email : undefined,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            signOut();
          }
        },
      );
    } else {
      // Android fallback - use Alert
      Alert.alert(user?.displayName || "Account", user?.email || "", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            signOut();
          },
        },
      ]);
    }
  };

  const handleLocationPress = (location: Location) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Bind the chosen location and record straight away — the job is optional
    // and assigned later. (JobSelect remains available for explicit job pick.)
    navigation.navigate("Camera", {
      locationId: location.id,
      locationName: location.name,
      address: location.address,
    });
  };

  const handleOtherLocationsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("AllLocations");
  };

  const handleGenericRecordingPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("GenericRecordingHub");
  };

  const handleFailedUploadsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("FailedUploads");
  };

  useEffect(() => {
    if (!hasObservedFailuresRef.current) {
      hasObservedFailuresRef.current = true;
      previousFailedCountRef.current = uploadQueue.failed;
      return;
    }

    if (uploadQueue.failed > previousFailedCountRef.current) {
      showToast(
        "Upload failed. Open Failed uploads to retry or delete.",
        "error",
      );
    }

    previousFailedCountRef.current = uploadQueue.failed;
  }, [showToast, uploadQueue.failed]);

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getFirstName = (): string => {
    if (user?.displayName) return user.displayName.split(" ")[0];
    if (user?.email) return user.email.split("@")[0];
    return "there";
  };

  const getFormattedDate = (): string => {
    const now = new Date();
    return now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#8E8E93" />
      </View>
    );
  }

  // "Other Locations" only earns its pinned slot when home can't already show
  // everything.
  const showOtherCta = locations.length > NEARBY_COUNT;
  const showPlaceholder = locations.length > 0 && nearest.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          !showOtherCta && { paddingBottom: insets.bottom + 24 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#8E8E93"
          />
        }
      >
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
                      ? "alert-circle"
                      : uploadQueue.needsAssignment > 0
                        ? "time-outline"
                        : "cloud-upload-outline"
                  }
                  size={16}
                  color={
                    uploadQueue.failed > 0
                      ? "#FF9500"
                      : uploadQueue.needsAssignment > 0
                        ? "#C2410C"
                        : "#007AFF"
                  }
                />
              )}
              <Text
                style={[
                  styles.uploadStatusText,
                  (uploadQueue.failed > 0 || uploadQueue.needsAssignment > 0) &&
                    styles.uploadStatusTextWarning,
                ]}
              >
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
                <Ionicons
                  name="alert-circle-outline"
                  size={24}
                  color="#B45309"
                />
              </View>
              <View style={styles.failedCardBody}>
                <Text style={styles.failedCardTitle}>Failed uploads</Text>
                <Text style={styles.failedCardText}>
                  Review failed videos, retry them, or delete the ones you want
                  to discard.
                </Text>
              </View>
              <View style={styles.failedBadge}>
                <Text style={styles.failedBadgeText}>{uploadQueue.failed}</Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.genericPill}
            activeOpacity={0.7}
            onPress={handleGenericRecordingPress}
          >
            <Ionicons name="radio-outline" size={16} color="#0F766E" />
            <Text style={styles.genericPillText}>Generic recording</Text>
            {uploadQueue.needsAssignment > 0 ? (
              <View style={styles.genericPillBadge}>
                <Text style={styles.genericPillBadgeText}>
                  {uploadQueue.needsAssignment}
                </Text>
              </View>
            ) : (
              <Ionicons
                name="chevron-forward"
                size={14}
                color="#8E8E93"
                style={{ marginLeft: 4 }}
              />
            )}
          </TouchableOpacity>

          {/* Stats Bar */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#fff",
              borderRadius: 16,
              marginBottom: 24,
              padding: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            {/* Stat 1: Locations */}
            <View style={{ flex: 1, alignItems: "center" }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: "#EFF6FF",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 8,
                }}
              >
                <MapPin size={18} color="#3B82F6" />
              </View>
              <Text
                style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}
              >
                {locations.length}
              </Text>
              <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                Locations
              </Text>
            </View>
            {/* Divider */}
            <View
              style={{
                width: 1,
                backgroundColor: "#E5E7EB",
                marginVertical: 8,
              }}
            />
            {/* Stat 2: Videos */}
            <View style={{ flex: 1, alignItems: "center" }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: "#F0FDF4",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 8,
                }}
              >
                <Video size={18} color="#22C55E" />
              </View>
              <Text
                style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}
              >
                {userStats.videosRecorded || 0}
              </Text>
              <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                Recorded
              </Text>
            </View>
            {/* Divider */}
            <View
              style={{
                width: 1,
                backgroundColor: "#E5E7EB",
                marginVertical: 8,
              }}
            />
            {/* Stat 3: This Week */}
            <View style={{ flex: 1, alignItems: "center" }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: "#FEF3C7",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 8,
                }}
              >
                <TrendingUp size={18} color="#F59E0B" />
              </View>
              <Text
                style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}
              >
                {userStats.thisWeek || 0}
              </Text>
              <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                This Week
              </Text>
            </View>
          </View>

          {/* Section Title */}
          {locations.length > 0 && (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Nearby</Text>
              <Text style={styles.sectionHint}>Tap to start recording</Text>
            </View>
          )}
        </View>

        {/* Nearest locations */}
        {nearest.map((entry, index) => (
          <LocationCard
            key={entry.location.id}
            location={entry.location}
            onPress={() => handleLocationPress(entry.location)}
            index={index}
            distanceLabel={
              gpsState === "ready" ? formatDistance(entry.distanceM) : undefined
            }
          />
        ))}

        {/* GPS placeholder. Enable CTA only when permission is actually
            missing — with permission granted (resolving / no usable fix yet)
            show loading copy instead. */}
        {showPlaceholder && (
          <View style={styles.placeholderWrap}>
            {gpsState === "denied" ? (
              <View style={styles.placeholderCard}>
                <View style={styles.placeholderIcon}>
                  <Ionicons name="navigate-outline" size={22} color="#3B82F6" />
                </View>
                <Text style={styles.placeholderTitle}>
                  Enable location to see nearby
                </Text>
                <Text style={styles.placeholderText}>
                  We&apos;ll show your closest assigned locations here.
                </Text>
                <TouchableOpacity
                  style={styles.placeholderButton}
                  activeOpacity={0.8}
                  onPress={handleEnableLocation}
                >
                  <Text style={styles.placeholderButtonText}>
                    Enable location
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.placeholderCard}>
                <ActivityIndicator size="small" color="#8E8E93" />
                <Text style={styles.placeholderText}>Loading locations…</Text>
              </View>
            )}
          </View>
        )}

        {/* Empty state — spinner while a fetch is in flight, static copy only
            when we genuinely have nothing after fetching */}
        {locations.length === 0 &&
          (fetching ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="small" color="#8E8E93" />
              <Text style={[styles.emptyText, { marginTop: 12 }]}>
                Loading locations…
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="location-outline" size={48} color="#D1D1D6" />
              <Text style={styles.emptyTitle}>No locations yet</Text>
              <Text style={styles.emptyText}>Pull down to refresh</Text>
            </View>
          ))}
      </ScrollView>

      {/* Pinned "Other Locations" CTA — always visible, outside the scroll */}
      {showOtherCta && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={styles.otherButton}
            activeOpacity={0.85}
            onPress={handleOtherLocationsPress}
          >
            <Ionicons name="list-outline" size={18} color="#FFFFFF" />
            <Text style={styles.otherButtonText}>Other Locations</Text>
            <View style={styles.otherBadge}>
              <Text style={styles.otherBadgeText}>{locations.length}</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  greeting: {
    fontSize: 15,
    color: "#8E8E93",
    fontWeight: "500",
    marginBottom: 2,
  },
  userName: {
    fontSize: 32,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: 14,
    color: "#C7C7CC",
    fontWeight: "500",
    marginTop: 4,
  },
  avatarButton: {
    padding: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#8E8E93",
  },
  // Upload Status
  uploadStatus: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 24,
  },
  uploadStatusText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#007AFF",
    marginLeft: 6,
  },
  uploadStatusTextWarning: {
    color: "#FF9500",
  },
  genericPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 20,
  },
  genericPillText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#0F766E",
    marginLeft: 6,
  },
  genericPillBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#0F766E",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    marginLeft: 6,
  },
  genericPillBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  failedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  failedCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  failedCardBody: {
    flex: 1,
    marginRight: 12,
  },
  failedCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9A3412",
  },
  failedCardText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: "#B45309",
  },
  failedBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EA580C",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  failedBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
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
  // GPS placeholder
  placeholderWrap: {
    paddingHorizontal: 20,
  },
  placeholderCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    padding: 24,
    alignItems: "center",
  },
  placeholderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  placeholderText: {
    fontSize: 13,
    color: "#8E8E93",
    textAlign: "center",
    marginTop: 4,
  },
  placeholderButton: {
    marginTop: 16,
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  placeholderButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Pinned footer CTA
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  otherButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  otherButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 8,
  },
  otherBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
    marginLeft: 8,
  },
  otherBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
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
  },
});
