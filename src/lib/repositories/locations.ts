/**
 * Locations Repository
 * Data access layer for location CRUD operations
 * Uses Firebase Admin SDK for server-side operations
 */

import { adminDb, getAdminApp } from "@/lib/firebaseAdmin";
import type { Location, LocationStatus } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import { geocodeAddress } from "@/lib/geocoding";

const COLLECTION = "locations";

/**
 * Coordinates are considered missing when absent or a placeholder (0,0) —
 * AddressAutocomplete emits {lat:0,lng:0} when the user types a raw address
 * without picking a Places suggestion.
 */
function hasUsableCoordinates(coordinates?: {
  lat: number;
  lng: number;
}): boolean {
  return Boolean(
    coordinates &&
    typeof coordinates.lat === "number" &&
    typeof coordinates.lng === "number" &&
    !(coordinates.lat === 0 && coordinates.lng === 0),
  );
}

/**
 * Create a new location
 */
export async function createLocation(
  data: Omit<Location, "locationId" | "createdAt" | "updatedAt">,
  createdBy: string,
): Promise<string> {
  const locationId = randomUUID();
  const now = new Date();

  // Backfill coordinates from the address when the client didn't supply usable
  // ones (Places geometry is preferred; geocoding covers raw-typed addresses).
  let coordinates = data.coordinates;
  if (!hasUsableCoordinates(coordinates) && data.address) {
    const geocoded = await geocodeAddress(data.address);
    if (geocoded) coordinates = geocoded;
  }

  const location: Location = {
    locationId,
    name: data.name,
    address: data.address,
    type: data.type,
    primaryContact: data.primaryContact,
    partnerOrgId: data.partnerOrgId,
    assignedOrganizationId: data.assignedOrganizationId,
    assignedOrganizationName: data.assignedOrganizationName,
    accessInstructions: data.accessInstructions,
    entryCode: data.entryCode,
    parkingInfo: data.parkingInfo,
    status: data.status || "active",
    coordinates,
    createdAt: now,
    updatedAt: now,
    createdBy,
  };

  await adminDb
    .collection(COLLECTION)
    .doc(locationId)
    .set({
      ...location,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

  return locationId;
}

/**
 * Get location by ID
 */
export async function getLocation(
  locationId: string,
): Promise<Location | null> {
  const doc = await adminDb.collection(COLLECTION).doc(locationId).get();
  if (!doc.exists) {
    return null;
  }
  return normalizeLocation(doc.id, doc.data());
}

/**
 * List locations (with optional partner filter)
 */
export async function listLocations(
  partnerOrgId?: string,
  status?: LocationStatus,
): Promise<Location[]> {
  const app = getAdminApp();
  console.log("[repo] listLocations - Starting", {
    collection: COLLECTION,
    partnerOrgId,
    status,
    projectId: app.options.projectId,
  });

  let query: FirebaseFirestore.Query = adminDb.collection(COLLECTION);

  if (partnerOrgId) {
    query = query.where("partnerOrgId", "==", partnerOrgId);
    console.log(
      "[repo] listLocations - Filtering by partnerOrgId:",
      partnerOrgId,
    );
  }

  if (status) {
    query = query.where("status", "==", status);
    console.log("[repo] listLocations - Filtering by status:", status);
  }

  try {
    console.log("[repo] listLocations - Executing Firestore query...");
    const snapshot = await query.get();
    console.log(
      "[repo] listLocations - ✅ Query successful, found",
      snapshot.docs.length,
      "documents",
    );
    return snapshot.docs.map((doc) => normalizeLocation(doc.id, doc.data()));
  } catch (error: any) {
    console.error("[repo] listLocations - ❌ Query failed:", {
      code: error.code,
      message: error.message,
      stack: error.stack,
      collection: COLLECTION,
      partnerOrgId,
      status,
    });
    throw error;
  }
}

/**
 * Get locations by partner (alias for listLocations with partner filter)
 */
export async function getLocationsByPartner(
  partnerId: string,
): Promise<Location[]> {
  return listLocations(partnerId);
}

/**
 * Update location
 */
export async function updateLocation(
  locationId: string,
  updates: Partial<Omit<Location, "locationId" | "createdAt" | "createdBy">>,
): Promise<void> {
  const updateData: any = {
    ...updates,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Re-geocode when the address changes but no usable coordinates were supplied.
  if (updates.address && !hasUsableCoordinates(updates.coordinates)) {
    const geocoded = await geocodeAddress(updates.address);
    if (geocoded) updateData.coordinates = geocoded;
  }

  // Handle clearing organization assignment
  if (
    updates.assignedOrganizationId === null ||
    updates.assignedOrganizationId === undefined ||
    updates.assignedOrganizationId === ""
  ) {
    updateData.assignedOrganizationId = FieldValue.delete();
    updateData.assignedOrganizationName = FieldValue.delete();
  }

  await adminDb.collection(COLLECTION).doc(locationId).update(updateData);
}

/**
 * Assign organization to location
 */
export async function assignOrganizationToLocation(
  locationId: string,
  organizationId: string,
  organizationName?: string,
): Promise<void> {
  await adminDb.collection(COLLECTION).doc(locationId).update({
    assignedOrganizationId: organizationId,
    assignedOrganizationName: organizationName,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Unassign organization from location
 */
export async function unassignOrganizationFromLocation(
  locationId: string,
): Promise<void> {
  await adminDb.collection(COLLECTION).doc(locationId).update({
    assignedOrganizationId: FieldValue.delete(),
    assignedOrganizationName: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Delete location (soft delete - mark as inactive)
 */
export async function deleteLocation(locationId: string): Promise<void> {
  await adminDb.collection(COLLECTION).doc(locationId).update({
    status: "inactive",
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Get location with all tasks and instructions (for teleoperator view)
 */
export async function getLocationWithAllTasksAndInstructions(
  locationId: string,
) {
  console.log(
    "[repo] getLocationWithAllTasksAndInstructions - Fetching for location:",
    locationId,
  );

  const locationDoc = await adminDb
    .collection(COLLECTION)
    .doc(locationId)
    .get();

  if (!locationDoc.exists) {
    console.log(
      "[repo] getLocationWithAllTasksAndInstructions - Location not found",
    );
    return null;
  }

  const locationData = locationDoc.data();

  // Get all active tasks for this location
  // Note: We fetch all and sort in memory to avoid composite index requirements
  const tasksSnapshot = await locationDoc.ref
    .collection("tasks")
    .where("status", "==", "active")
    .get();

  console.log(
    "[repo] getLocationWithAllTasksAndInstructions - Found",
    tasksSnapshot.docs.length,
    "tasks",
  );

  const tasks = [];

  for (const taskDoc of tasksSnapshot.docs) {
    const taskData = taskDoc.data();

    // Get all instructions for this task
    const instructionsSnapshot = await taskDoc.ref
      .collection("instructions")
      .orderBy("stepNumber", "asc")
      .get();

    const instructions = instructionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt:
        doc.data().createdAt?.toDate?.() || doc.data().createdAt || new Date(),
      updatedAt:
        doc.data().updatedAt?.toDate?.() || doc.data().updatedAt || new Date(),
    }));

    tasks.push({
      id: taskDoc.id,
      ...taskData,
      createdAt:
        taskData.createdAt?.toDate?.() || taskData.createdAt || new Date(),
      updatedAt:
        taskData.updatedAt?.toDate?.() || taskData.updatedAt || new Date(),
      instructions,
    });
  }

  // Sort tasks by priority (ascending, 1 = highest) then by createdAt (descending)
  tasks.sort((a, b) => {
    const priorityA = (a as any).priority || 3;
    const priorityB = (b as any).priority || 3;
    if (priorityA !== priorityB) {
      return priorityA - priorityB; // Lower number = higher priority
    }
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA; // Newer first
  });

  console.log(
    "[repo] getLocationWithAllTasksAndInstructions - Returning location with",
    tasks.length,
    "tasks",
  );

  return {
    locationId: locationDoc.id,
    ...locationData,
    createdAt:
      locationData?.createdAt?.toDate?.() ||
      locationData?.createdAt ||
      new Date(),
    updatedAt:
      locationData?.updatedAt?.toDate?.() ||
      locationData?.updatedAt ||
      new Date(),
    tasks,
  };
}

/**
 * Normalize Firestore document to Location type
 */
function normalizeLocation(id: string, data: any): Location {
  return {
    locationId: id,
    name: data.name || "",
    address: data.address || "",
    type: data.type || "other",
    primaryContact: data.primaryContact,
    partnerOrgId: data.partnerOrgId || "",
    assignedOrganizationId: data.assignedOrganizationId,
    assignedOrganizationName: data.assignedOrganizationName,
    accessInstructions: data.accessInstructions,
    entryCode: data.entryCode,
    parkingInfo: data.parkingInfo,
    status: data.status || "active",
    coordinates: data.coordinates,
    createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date(),
    createdBy: data.createdBy,
  };
}
