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

async function readCacheEnvelope<T>(
  key: string,
): Promise<CacheEnvelope<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEnvelope<T>;
  } catch (error) {
    console.warn(`[cache] read failed for ${key}`, error);
    return null;
  }
}

async function readCache<T>(key: string): Promise<T | null> {
  const envelope = await readCacheEnvelope<T>(key);
  return envelope?.data ?? null;
}

async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    const envelope: CacheEnvelope<T> = { cachedAt: Date.now(), data };
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
  } catch (error) {
    console.warn(`[cache] write failed for ${key}`, error);
  }
}

/**
 * Assigned-location lists change rarely, so a cache younger than this is
 * treated as fresh and the background revalidate is skipped.
 */
const LOCATIONS_TTL_MS = 15 * 60 * 1000;

// In-memory layer on top of AsyncStorage: skips a disk round-trip on rapid
// re-focus, and `inflightLocations` collapses concurrent callers (e.g. a focus
// re-resolve racing a Locations-list open) onto a single network request.
const memoryLocations = new Map<string, CacheEnvelope<Location[]>>();
const inflightLocations = new Map<string, Promise<Location[]>>();

export interface CachedLocationsResult {
  locations: Location[];
  /** Served from memory/disk without hitting the network this call. */
  fromCache: boolean;
  /** Cache is older than the TTL (or absent) — caller should revalidate. */
  stale: boolean;
}

/**
 * Read assigned locations from cache only (memory → disk), no network. Lets the
 * camera bind a location instantly on focus; pair with
 * `refreshAssignedLocationsInBackground` to revalidate when `stale`.
 */
export async function getAssignedLocationsCacheFirst(): Promise<CachedLocationsResult> {
  const currentUser = getAuth().currentUser;
  if (!currentUser) return { locations: [], fromCache: false, stale: true };

  const uid = currentUser.uid;
  let envelope: CacheEnvelope<Location[]> | null =
    memoryLocations.get(uid) ?? null;

  if (!envelope) {
    envelope = await readCacheEnvelope<Location[]>(
      `${LOCATIONS_CACHE_PREFIX}${uid}`,
    );
    if (envelope) memoryLocations.set(uid, envelope);
  }

  if (!envelope) return { locations: [], fromCache: false, stale: true };

  const stale = Date.now() - envelope.cachedAt > LOCATIONS_TTL_MS;
  return { locations: envelope.data, fromCache: true, stale };
}

/**
 * Network fetch of assigned locations, de-duplicated per uid and writing both
 * cache layers. On failure falls back to the last good snapshot (memory →
 * disk) so the cleaner never sees an empty list on a flaky connection.
 */
function revalidateAssignedLocations(
  currentUser: NonNullable<ReturnType<typeof getAuth>["currentUser"]>,
): Promise<Location[]> {
  const uid = currentUser.uid;
  const existing = inflightLocations.get(uid);
  if (existing) return existing;

  const cacheKey = `${LOCATIONS_CACHE_PREFIX}${uid}`;
  const promise = (async () => {
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(
        `${API_BASE_URL}/api/users/${uid}/assigned-locations`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const data = await response.json();
      if (!data.success || !Array.isArray(data.assignments)) {
        // Server reachable but payload empty / malformed — prefer the last
        // good snapshot over an empty list.
        const cached =
          memoryLocations.get(uid)?.data ??
          (await readCache<Location[]>(cacheKey));
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

      memoryLocations.set(uid, { cachedAt: Date.now(), data: locations });
      await writeCache(cacheKey, locations);
      return locations;
    } catch (error) {
      console.error(
        "❌ Failed to fetch current user assigned locations:",
        error,
      );
      const cached =
        memoryLocations.get(uid)?.data ??
        (await readCache<Location[]>(cacheKey));
      if (cached) {
        console.log(`📦 Serving ${cached.length} cached locations (offline)`);
        return cached;
      }
      return [];
    } finally {
      inflightLocations.delete(uid);
    }
  })();

  inflightLocations.set(uid, promise);
  return promise;
}

/**
 * Trigger a network revalidate without blocking the caller's UI on it. Reuses
 * the in-flight request if one is already running. Returns the fresh list.
 */
export function refreshAssignedLocationsInBackground(): Promise<Location[]> {
  const currentUser = getAuth().currentUser;
  if (!currentUser) return Promise.resolve([]);
  return revalidateAssignedLocations(currentUser);
}

/**
 * Network-first fetch (writes cache). Kept for callers that want the freshest
 * list and can wait — e.g. the manual Locations list and pending-uploads.
 */
export async function fetchAssignedLocationsForCurrentUser(): Promise<
  Location[]
> {
  const currentUser = getAuth().currentUser;
  if (!currentUser) return [];
  return revalidateAssignedLocations(currentUser);
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
 * Save media metadata via teleoperator API.
 *
 * Auth is best-effort: we attach a fresh ID token and the recording cleaner's
 * uid so the backend can attribute recording hours. The endpoint still accepts
 * unauthenticated calls, so a missing/expired token never fails the upload — it
 * just degrades attribution.
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
  userId?: string;
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

    // Resolve uid + a fresh token. Prefer the uid captured at record time
    // (data.userId); fall back to the currently signed-in user. Token is
    // fetched fresh so it auto-refreshes if the queued item is retried later.
    const currentUser = getAuth().currentUser;
    const userId = data.userId ?? currentUser?.uid;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    try {
      const token = await currentUser?.getIdToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn("💾 Could not attach auth token to metadata save", error);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/teleoperator/media/metadata`,
      {
        method: "POST",
        headers,
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
          userId,
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
