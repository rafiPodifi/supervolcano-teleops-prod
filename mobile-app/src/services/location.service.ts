/**
 * LOCATION SERVICE
 * Handles GPS location and reverse geocoding
 */

import * as Location from "expo-location";
import { Alert, Linking, Platform } from "react-native";
import type { Location as AssignedLocation } from "../types";

/**
 * Max distance (meters) for a location to count as a match. Not enforced yet —
 * the current product decision is "always bind the nearest". Wire this into
 * findNearestAssignedLocation once a radius is chosen.
 */
export const MATCH_RADIUS_M = Infinity;

export interface AddressResult {
  formattedAddress: string;
  streetNumber?: string;
  street?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

class LocationService {
  /**
   * Request location permission
   */
  async requestPermission(): Promise<boolean> {
    try {
      const { status: existingStatus } =
        await Location.getForegroundPermissionsAsync();

      if (existingStatus === "granted") {
        return true;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Location Permission Required",
          "Please enable location access in Settings to use this feature.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                if (Platform.OS === "ios") {
                  Linking.openURL("app-settings:");
                } else {
                  Linking.openSettings();
                }
              },
            },
          ],
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("[Location] Permission error:", error);
      return false;
    }
  }

  /**
   * Get current location coordinates
   */
  async getCurrentCoordinates(): Promise<{
    latitude: number;
    longitude: number;
  } | null> {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) return null;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error("[Location] Get coordinates error:", error);
      return null;
    }
  }

  /**
   * Last-known coordinates — returns instantly from the OS cache (no fresh GPS
   * fix). May be null/stale, but lets the camera bind a nearest location
   * immediately while a precise fix resolves in the background. Does not prompt
   * for permission; only reads if already granted.
   */
  async getLastKnownCoordinates(): Promise<{
    latitude: number;
    longitude: number;
  } | null> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") return null;

      const last = await Location.getLastKnownPositionAsync();
      if (!last) return null;

      return {
        latitude: last.coords.latitude,
        longitude: last.coords.longitude,
      };
    } catch (error) {
      console.warn("[Location] Last-known coords error:", error);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<AddressResult | null> {
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (!results || results.length === 0) {
        return null;
      }

      const result = results[0];

      // Build formatted address
      const addressParts = [result.streetNumber, result.street].filter(Boolean);

      const streetAddress = addressParts.join(" ");

      const fullAddressParts = [
        streetAddress,
        result.city,
        result.region,
        result.postalCode,
      ].filter(Boolean);

      return {
        formattedAddress: fullAddressParts.join(", "),
        streetNumber: result.streetNumber || undefined,
        street: result.street || undefined,
        city: result.city || undefined,
        region: result.region || undefined,
        postalCode: result.postalCode || undefined,
        country: result.country || undefined,
        latitude,
        longitude,
      };
    } catch (error) {
      console.error("[Location] Reverse geocode error:", error);
      return null;
    }
  }

  /**
   * Get current address (combines getCurrentCoordinates + reverseGeocode)
   */
  async getCurrentAddress(): Promise<AddressResult | null> {
    try {
      const coords = await this.getCurrentCoordinates();
      if (!coords) return null;

      const address = await this.reverseGeocode(
        coords.latitude,
        coords.longitude,
      );
      return address;
    } catch (error) {
      console.error("[Location] Get current address error:", error);
      return null;
    }
  }
}

export const locationService = new LocationService();

/**
 * Great-circle distance between two coordinates, in meters.
 */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000; // Earth radius (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Pick the assigned location closest to the given coordinates. Locations
 * without coordinates are ignored. Returns null when none have coordinates.
 *
 * MATCH_RADIUS_M is currently Infinity (nearest-always); once a radius is set,
 * filter out matches beyond it here.
 */
export function findNearestAssignedLocation(
  coords: { latitude: number; longitude: number },
  locations: AssignedLocation[],
): { location: AssignedLocation; distanceM: number } | null {
  let best: { location: AssignedLocation; distanceM: number } | null = null;

  for (const location of locations) {
    if (
      typeof location.latitude !== "number" ||
      typeof location.longitude !== "number"
    ) {
      continue;
    }

    const distanceM = haversineMeters(coords, {
      latitude: location.latitude,
      longitude: location.longitude,
    });

    if (distanceM > MATCH_RADIUS_M) continue;
    if (!best || distanceM < best.distanceM) {
      best = { location, distanceM };
    }
  }

  return best;
}
