/**
 * ALL LOCATIONS SCREEN
 * Full assigned-location list for cleaners. Reached from the home screen's
 * "Other Locations" CTA. Sorted nearest-first when GPS coords are available
 * (locations without coordinates appended), alphabetical otherwise.
 */

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";
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

interface ListEntry {
  location: Location;
  distanceM: number | null;
}

function buildEntries(
  locations: Location[],
  coords: { latitude: number; longitude: number } | null,
): ListEntry[] {
  if (coords) {
    const withDistance = nearestAssignedLocations(
      coords,
      locations,
      locations.length,
    );
    const ranked = new Set(withDistance.map((entry) => entry.location.id));
    const coordless = locations.filter((location) => !ranked.has(location.id));
    return [
      ...withDistance.map((entry) => ({
        location: entry.location,
        distanceM: entry.distanceM,
      })),
      ...coordless.map((location) => ({ location, distanceM: null })),
    ];
  }
  return [...locations]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((location) => ({ location, distanceM: null }));
}

export default function AllLocationsScreen({ navigation }: any) {
  const [entries, setEntries] = useState<ListEntry[]>([]);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (forceNetwork: boolean) => {
    const cache = await getAssignedLocationsCacheFirst();
    let locations = cache.locations;
    if (forceNetwork || cache.stale || locations.length === 0) {
      setFetching(true);
      try {
        locations = await refreshAssignedLocationsInBackground();
      } finally {
        setFetching(false);
      }
    }
    const coords = await locationService.getLastKnownCoordinates();
    setEntries(buildEntries(locations, coords));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLocationPress = (location: Location) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Camera", {
      locationId: location.id,
      locationName: location.name,
      address: location.address,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>All Locations</Text>
          <Text style={styles.subtitle}>
            {entries.length === 1
              ? "1 location"
              : `${entries.length} locations`}{" "}
            • Tap to start recording
          </Text>
        </View>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.location.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#8E8E93"
          />
        }
        renderItem={({ item, index }) => (
          <LocationCard
            location={item.location}
            onPress={() => handleLocationPress(item.location)}
            index={index}
            distanceLabel={
              item.distanceM != null
                ? formatDistance(item.distanceM)
                : undefined
            }
          />
        )}
        ListEmptyComponent={
          fetching ? (
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
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 2,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
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
