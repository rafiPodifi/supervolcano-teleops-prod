import { firestore } from "../config/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { Location, Job } from "../types";
import { getApiBaseUrl } from "./api-base";
import { getAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = getApiBaseUrl();

/**
 * Offline cache for the two reads that field workers hit before they have
 * internet at the site. Stale-while-revalidate: every successful network
 * fetch overwrites the cache; if the network fetch fails we fall back to
 * the last good payload so the cleaner can still see assigned locations
 * and jobs.
 */
const LOCATIONS_CACHE_PREFIX = "cache:assignedLocations:";
const JOBS_CACHE_PREFIX = "cache:jobsForLocation:";

interface CacheEnvelope<T> {
  cachedAt: number;
  data: T;
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    return parsed?.data ?? null;
  } catch (error) {
    console.warn(`[cache] read failed for ${key}`, error);
    return null;
  }
}

async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    const envelope: CacheEnvelope<T> = { cachedAt: Date.now(), data };
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
  } catch (error) {
    console.warn(`[cache] write failed for ${key}`, error);
  }
}

export async function fetchAssignedLocationsForCurrentUser(): Promise<
  Location[]
> {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return [];
  }

  const cacheKey = `${LOCATIONS_CACHE_PREFIX}${currentUser.uid}`;

  try {
    const token = await currentUser.getIdToken();
    const response = await fetch(
      `${API_BASE_URL}/api/users/${currentUser.uid}/assigned-locations`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await response.json();
    if (!data.success || !Array.isArray(data.assignments)) {
      // Server reachable but payload empty / malformed — prefer the last
      // good snapshot over an empty list so the cleaner doesn't see "No
      // locations" on a flaky response.
      const cached = await readCache<Location[]>(cacheKey);
      return cached ?? [];
    }

    const locations = data.assignments.map((assignment: any) => ({
      id: assignment.location_id,
      name: assignment.location_name || "Unnamed Location",
      address: assignment.location_address || "",
      assignedOrganizationName: "",
      latitude:
        typeof assignment.latitude === "number"
          ? assignment.latitude
          : undefined,
      longitude:
        typeof assignment.longitude === "number"
          ? assignment.longitude
          : undefined,
    })) as Location[];

    await writeCache(cacheKey, locations);
    return locations;
  } catch (error) {
    console.error("❌ Failed to fetch current user assigned locations:", error);
    const cached = await readCache<Location[]>(cacheKey);
    if (cached) {
      console.log(`📦 Serving ${cached.length} cached locations (offline)`);
      return cached;
    }
    return [];
  }
}

/**
 * Fetch assigned location IDs for a user
 * Used to filter locations in mobile app
 */
export async function fetchAssignedLocationIds(
  userId: string,
): Promise<string[]> {
  try {
    console.log(`📍 Fetching assigned locations for user: ${userId}`);

    const response = await fetch(
      `${API_BASE_URL}/api/users/${userId}/assigned-locations`,
    );
    const data = await response.json();

    if (!data.success) {
      console.warn("⚠️ Failed to fetch assigned locations:", data.error);
      return []; // Return empty array if API fails - will show all locations
    }

    console.log(
      `📍 User assigned to ${data.count} locations:`,
      data.locationIds,
    );
    return data.locationIds || [];
  } catch (error: any) {
    console.error("❌ Failed to fetch assigned locations:", error);
    return []; // Return empty array on error - will show all locations
  }
}

/**
 * Fetch all locations from Firestore with deep debugging
 */
export async function fetchLocations(): Promise<Location[]> {
  try {
    console.log("📍 === FETCH LOCATIONS DEBUG ===");
    console.log("📍 Firestore instance:", firestore ? "EXISTS" : "MISSING");
    console.log("📍 Firestore app:", firestore?.app?.name);

    // Test 1: Try to list all collections (root level)
    console.log("📍 Test 1: Attempting to query locations collection...");

    const locationsRef = collection(firestore, "locations");
    console.log("📍 Collection reference created:", locationsRef.path);
    console.log("📍 Collection ID:", locationsRef.id);
    console.log("📍 Collection parent:", locationsRef.parent?.path);

    console.log("📍 Executing getDocs...");
    const locationsSnap = await getDocs(locationsRef);
    console.log("📍 Query completed. Snapshot received.");
    console.log("📍 Snapshot size:", locationsSnap.size);
    console.log("📍 Snapshot empty:", locationsSnap.empty);
    console.log(
      "📍 Snapshot metadata:",
      JSON.stringify(locationsSnap.metadata),
    );

    if (locationsSnap.empty) {
      console.warn("⚠️ Query returned empty! But 7 docs exist in console.");
      console.warn("⚠️ Possible causes:");
      console.warn("  1. Firestore rules blocking read");
      console.warn("  2. Wrong database instance");
      console.warn("  3. Collection name mismatch");
      console.warn("  4. Network/cache issue");

      // Test 2: Try to get a specific document if we know an ID
      console.log("📍 Test 2: Attempting direct document read...");
      console.log("📍 (Skipping - need document ID)");
    }

    const locations: Location[] = [];

    locationsSnap.forEach((docSnap) => {
      console.log("📍 Processing document:", docSnap.id);
      const data = docSnap.data();
      console.log("📍 Document data keys:", Object.keys(data));
      console.log("📍 Document name:", data.name);

      locations.push({
        id: docSnap.id,
        ...data,
      } as Location);
    });

    console.log("📍 Total locations processed:", locations.length);
    console.log("📍 === END DEBUG ===");

    return locations;
  } catch (error: any) {
    console.error("❌ === FETCH LOCATIONS ERROR ===");
    console.error("❌ Error name:", error.name);
    console.error("❌ Error message:", error.message);
    console.error("❌ Error code:", error.code);
    console.error("❌ Error stack:", error.stack);
    console.error(
      "❌ Full error:",
      JSON.stringify(error, Object.getOwnPropertyNames(error)),
    );
    console.error("❌ === END ERROR ===");
    throw error;
  }
}

/**
 * Test function to fetch a specific location by ID
 */
export async function testFetchSpecificLocation(locationId: string) {
  try {
    console.log(`🧪 Testing fetch for location: ${locationId}`);

    const docRef = doc(firestore, "locations", locationId);
    console.log("🧪 Document reference:", docRef.path);

    const docSnap = await getDoc(docRef);
    console.log("🧪 Document exists:", docSnap.exists());

    if (docSnap.exists()) {
      console.log("🧪 Document data:", docSnap.data());
      return docSnap.data();
    } else {
      console.log("🧪 Document does NOT exist");
      return null;
    }
  } catch (error: any) {
    console.error("🧪 Test failed:", error);
    console.error("🧪 Error code:", error.code);
    console.error("🧪 Error message:", error.message);
    throw error;
  }
}

/**
 * Fetch locations using REST API (fallback method)
 */
export async function fetchLocationsViaREST(): Promise<Location[]> {
  try {
    const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    const databaseId =
      process.env.EXPO_PUBLIC_FIREBASE_DATABASE_ID || "default";

    // Use 'default' not '(default)'!
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/locations?key=${apiKey}`;

    console.log("🌐 Fetching via REST API...");
    console.log("🌐 Database ID:", databaseId);
    console.log("🌐 URL:", url);

    const response = await fetch(url);
    console.log("🌐 REST API response status:", response.status);

    const data = await response.json();
    console.log("🌐 REST API response:", JSON.stringify(data, null, 2));

    if (response.status !== 200) {
      console.error("🌐 REST API error:", data);
      return [];
    }

    if (data.documents) {
      console.log("🌐 Found documents:", data.documents.length);

      const locations = data.documents.map((doc: any) => {
        const id = doc.name.split("/").pop();
        const fields = doc.fields;

        return {
          id,
          name: fields.name?.stringValue || "",
          address: fields.address?.stringValue || "",
          assignedOrganizationName:
            fields.assignedOrganizationName?.stringValue || "",
          assignedOrganizationId:
            fields.assignedOrganizationId?.stringValue || "",
        } as Location;
      });

      console.log("🌐 Parsed locations:", locations.length);
      return locations;
    }

    console.warn("🌐 No documents in response");
    return [];
  } catch (error: any) {
    console.error("🌐 REST API failed:", error);
    throw error;
  }
}

/**
 * Fetch jobs for a specific location.
 *
 * Goes through the backend (Admin SDK) instead of querying Firestore
 * directly: the client-SDK rule on the top-level `tasks` collection keys
 * on `partnerOrgId`, so a location-scoped query is rejected outright with
 * permission-denied. The backend verifies the caller is assigned to the
 * location, then runs the query with admin privileges.
 */
export async function fetchJobsForLocation(locationId: string): Promise<Job[]> {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("No authenticated user");
  }

  const cacheKey = `${JOBS_CACHE_PREFIX}${locationId}`;

  try {
    console.log("\n💼 === FETCH JOBS ===");
    console.log("💼 Location ID:", locationId);

    const token = await currentUser.getIdToken();
    const response = await fetch(
      `${API_BASE_URL}/api/mobile/locations/${locationId}/tasks`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      // Avoid the words "fetch"/"network" here — user-facing-error.ts
      // classifies any message containing them as a connectivity error.
      throw new Error(data.error || `Jobs request returned ${response.status}`);
    }

    const jobs = (Array.isArray(data.jobs) ? data.jobs : []) as Job[];
    console.log("💼 Total jobs returned:", jobs.length);
    await writeCache(cacheKey, jobs);
    return jobs;
  } catch (error: any) {
    console.error("❌ Failed to fetch jobs:", error);
    console.error("❌ Error message:", error.message);
    const cached = await readCache<Job[]>(cacheKey);
    if (cached) {
      console.log(
        `📦 Serving ${cached.length} cached jobs for location ${locationId} (offline)`,
      );
      return cached;
    }
    throw error;
  }
}

/**
 * Save media metadata via teleoperator API (no auth required)
 */
export async function saveMediaMetadata(data: {
  taskId?: string;
  locationId: string;
  storageUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  durationSeconds?: number;
  latitude?: number;
  longitude?: number;
  startedAt?: string;
  endedAt?: string;
}) {
  try {
    console.log("💾 Saving media metadata...");
    console.log(
      "💾 API URL:",
      `${API_BASE_URL}/api/teleoperator/media/metadata`,
    );
    console.log("💾 Data:", {
      taskId: data.taskId,
      locationId: data.locationId,
      fileName: data.fileName,
      fileSize: data.fileSize,
      durationSeconds: data.durationSeconds,
    });

    const response = await fetch(
      `${API_BASE_URL}/api/teleoperator/media/metadata`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: data.taskId,
          locationId: data.locationId,
          mediaType: "video",
          storageUrl: data.storageUrl,
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          durationSeconds: data.durationSeconds,
          latitude: data.latitude,
          longitude: data.longitude,
          startedAt: data.startedAt,
          endedAt: data.endedAt,
        }),
      },
    );

    const responseText = await response.text();
    console.log("💾 Response status:", response.status);
    console.log("💾 Response ok:", response.ok);
    console.log("💾 Response text:", responseText);

    if (!response.ok) {
      console.error("❌ API returned error status:", response.status);
      throw new Error(`API error ${response.status}: ${responseText}`);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error("❌ Failed to parse JSON response");
      throw new Error(`Invalid JSON response: ${responseText}`);
    }

    if (!result.success) {
      console.error("❌ API returned success: false");
      console.error("❌ Error from API:", result.error);
      throw new Error(result.error || "Failed to save metadata");
    }

    console.log("✅ Media metadata saved successfully");
    console.log("✅ Media ID:", result.id);
    console.log("✅ Storage URL:", result.url?.substring(0, 100));
    return result;
  } catch (error: any) {
    console.error("═══════════════════════════════════════");
    console.error("❌ SAVE METADATA FAILED");
    console.error("═══════════════════════════════════════");
    console.error("Error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    throw error;
  }
}
