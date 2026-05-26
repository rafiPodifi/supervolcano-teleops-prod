/**
 * API Route: GET /api/admin/locations/[id]/media
 * Fetches all media (videos) for a specific location from Firestore
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getUserClaims, requireRole } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Authentication check
    const token = request.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const claims = await getUserClaims(token);
    if (!claims) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Only admins can view location media
    requireRole(claims, ["admin", "superadmin"]);

    const locationId = params.id;

    if (!locationId) {
      return NextResponse.json(
        { error: "Location ID is required" },
        { status: 400 },
      );
    }

    console.log("[API] Fetching media for location:", locationId);

    // Query Firestore media collection
    const mediaSnapshot = await adminDb
      .collection("media")
      .where("locationId", "==", locationId)
      .orderBy("uploadedAt", "desc")
      .get();

    const media = mediaSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        videoUrl: data.videoUrl,
        storagePath: data.storagePath,
        type: data.type || "video",
        locationId: data.locationId,
        userId: data.userId,
        organizationId: data.organizationId,
        fileSize: data.fileSize,
        status: data.status,
        uploadedAt:
          data.uploadedAt?.toDate?.()?.toISOString() || data.uploadedAt,
        recordedAt:
          data.recordedAt?.toDate?.()?.toISOString() || data.recordedAt || null,
        recordingEndedAt:
          data.recordingEndedAt?.toDate?.()?.toISOString() ||
          data.recordingEndedAt ||
          null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      };
    });

    console.log("[API] Found", media.length, "media items");

    return NextResponse.json({ media });
  } catch (error: any) {
    console.error("[API] Error fetching media:", error);

    // Handle role requirement errors
    if (
      error.message?.includes("role") ||
      error.message?.includes("permission")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch media" },
      { status: 500 },
    );
  }
}
