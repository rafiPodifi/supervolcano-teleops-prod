import { NextRequest, NextResponse } from "next/server";
import { getUserClaims } from "@/lib/utils/auth";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/[userId]/assigned-locations
 *
 * Get all locations assigned to a specific user (cleaner)
 * Used by mobile app to filter location list
 * Queries Firestore assignments collection (source of truth)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } },
) {
  try {
    // Auth check - user can only see their own assignments
    const token = request.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const claims = await getUserClaims(token);
    if (!claims) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get the current user's UID from the token
    const decodedToken = await adminAuth.verifyIdToken(token);
    const currentUserId = decodedToken.uid;

    const userId = params.userId;

    // Users can only see their own assignments (unless admin)
    if (
      claims.role !== "admin" &&
      claims.role !== "superadmin" &&
      currentUserId !== userId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Query Firestore assignments collection for active assignments
    const assignmentsSnapshot = await adminDb
      .collection("assignments")
      .where("user_id", "==", userId)
      .where("status", "==", "active")
      .get();

    const assignmentDocs = assignmentsSnapshot.docs;

    if (assignmentDocs.length === 0) {
      return NextResponse.json({
        success: true,
        locationIds: [],
        assignments: [],
        count: 0,
      });
    }

    // Extract location IDs
    const locationIds = assignmentDocs
      .map((doc) => {
        const data = doc.data();
        return data.location_id || data.locationId;
      })
      .filter(Boolean);

    // Batch fetch location details (Firestore 'in' query limit is 30)
    const locationMap = new Map<string, any>();

    // Fetch locations in batches of 30
    for (let i = 0; i < locationIds.length; i += 30) {
      const batch = locationIds.slice(i, i + 30);

      // Fetch each location individually (more reliable than 'in' query)
      await Promise.all(
        batch.map(async (locationId) => {
          try {
            const locationDoc = await adminDb
              .collection("locations")
              .doc(locationId)
              .get();
            if (locationDoc.exists) {
              const locationData = locationDoc.data();
              const coords = locationData?.coordinates;
              locationMap.set(locationId, {
                location_id: locationId,
                location_name:
                  locationData?.name || locationData?.address || locationId,
                location_address: locationData?.address || null,
                latitude: typeof coords?.lat === "number" ? coords.lat : null,
                longitude: typeof coords?.lng === "number" ? coords.lng : null,
              });
            }
          } catch (error) {
            console.error(`Failed to fetch location ${locationId}:`, error);
          }
        }),
      );
    }

    // Build assignments array with location details
    const assignments = assignmentDocs.map((doc) => {
      const data = doc.data();
      const locationId = data.location_id || data.locationId;
      const locationInfo = locationMap.get(locationId) || {
        location_id: locationId,
        location_name: locationId,
        location_address: null,
        latitude: null,
        longitude: null,
      };

      return {
        location_id: locationId,
        location_name: locationInfo.location_name,
        location_address: locationInfo.location_address,
        latitude: locationInfo.latitude ?? null,
        longitude: locationInfo.longitude ?? null,
        assigned_at:
          data.assigned_at?.toDate?.()?.toISOString() ||
          data.created_at?.toDate?.()?.toISOString() ||
          null,
      };
    });

    // Sort by assigned_at (newest first)
    assignments.sort((a, b) => {
      const dateA = a.assigned_at ? new Date(a.assigned_at).getTime() : 0;
      const dateB = b.assigned_at ? new Date(b.assigned_at).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({
      success: true,
      locationIds,
      assignments,
      count: locationIds.length,
    });
  } catch (error: any) {
    console.error("Failed to get assigned locations:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
