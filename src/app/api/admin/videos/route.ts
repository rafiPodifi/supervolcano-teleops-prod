/**
 * GET /api/admin/videos
 *
 * List all videos with AI annotations and filtering
 * Uses Firestore instead of SQL
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { getUserClaims, requireRole } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

// Helper function to determine if a document is a video
function isVideo(document: FirebaseFirestore.DocumentData): boolean {
  const type = document.type || document.mediaType || "";
  const mimeType = document.mimeType || document.contentType || "";
  const fileName = document.fileName || document.name || "";
  const videoUrl =
    document.videoUrl || document.url || document.storageUrl || "";
  const storagePath = document.storagePath || "";

  // Check explicit type fields
  if (type === "video" || type === "VIDEO") return true;
  if (mimeType?.startsWith?.("video/")) return true;

  // Check file extension in fileName
  const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];
  const lowerFileName = fileName.toLowerCase();
  if (videoExtensions.some((ext) => lowerFileName.endsWith(ext))) return true;

  // Check URL for video extension (for mobile uploads without mediaType)
  const lowerUrl = videoUrl.toLowerCase();
  if (videoExtensions.some((ext) => lowerUrl.includes(ext))) return true;

  // Check storagePath for video extension or videos folder
  const lowerPath = storagePath.toLowerCase();
  if (
    lowerPath.startsWith("videos/") ||
    videoExtensions.some((ext) => lowerPath.endsWith(ext))
  )
    return true;

  // Contribution uploads are always videos
  if (document.source === "web_contribute" && (videoUrl || storagePath)) {
    return true;
  }

  return false;
}

// Helper function to determine AI status
function getAIStatus(
  document: FirebaseFirestore.DocumentData,
): "pending" | "processing" | "completed" | "failed" {
  if (document.aiAnnotations || document.annotations) return "completed";
  if (document.aiError || document.annotationError) return "failed";
  if (
    document.aiProcessingStarted ||
    document.processing === true ||
    document.aiStatus === "processing"
  )
    return "processing";
  return "pending";
}

// Helper function to parse Firestore timestamp in any format
function parseFirestoreTimestamp(value: any): string | null {
  if (!value) return null;
  if (value.toDate && typeof value.toDate === "function")
    return value.toDate().toISOString();
  if (value._seconds !== undefined)
    return new Date(
      value._seconds * 1000 + (value._nanoseconds || 0) / 1000000,
    ).toISOString();
  if (typeof value === "number") {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (value instanceof Date)
    return isNaN(value.getTime()) ? null : value.toISOString();
  return null;
}

// Extract filename from URL or storagePath
function extractFileName(document: FirebaseFirestore.DocumentData): string {
  // First check explicit fileName field
  if (document.fileName) return document.fileName;
  if (document.name) return document.name;

  // Extract from storagePath
  if (document.storagePath) {
    const parts = document.storagePath.split("/");
    return parts[parts.length - 1] || "unknown";
  }

  // Extract from URL
  const url = document.videoUrl || document.url || document.storageUrl || "";
  if (url) {
    try {
      const urlPath = new URL(url).pathname;
      const decoded = decodeURIComponent(urlPath);
      const parts = decoded.split("/");
      return parts[parts.length - 1]?.split("?")[0] || "unknown";
    } catch {
      return "unknown";
    }
  }

  return "unknown";
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    await adminAuth.verifyIdToken(token);

    const claims = await getUserClaims(token);
    if (!claims)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    requireRole(claims, ["superadmin", "admin", "partner_admin"]);

    const { searchParams } = new URL(request.url);
    const statusFilter =
      searchParams.get("status") || searchParams.get("aiStatus") || "";
    const locationId = searchParams.get("locationId") || "";
    const limit = parseInt(searchParams.get("limit") || "200");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query: FirebaseFirestore.Query = adminDb.collection("media");

    if (locationId) {
      query = query.where("locationId", "==", locationId);
    }

    // Don't use orderBy - it excludes docs without the field
    // Sorting happens in JavaScript later which handles both uploadedAt and createdAt
    const snapshot = await query.get();

    const stats = {
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      blurPending: 0,
      pendingApproval: 0,
      approved: 0,
      rejected: 0,
    };
    const allVideoDocs: Array<{
      doc: FirebaseFirestore.QueryDocumentSnapshot;
      aiStatus: string;
    }> = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (!isVideo(data)) return;

      const aiStatus = getAIStatus(data);
      const source = data.source;
      const reviewStatus = data.reviewStatus;
      const needsBlur =
        source === "web_contribute" || reviewStatus !== undefined;
      const blurApproved = reviewStatus === "approved";

      // Count blur pending
      if (needsBlur && !blurApproved) {
        stats.blurPending++;
      }

      // Count AI status (only if blur not needed or blur approved)
      if (!needsBlur || blurApproved) {
        if (aiStatus === "pending") stats.queued++;
        else if (aiStatus === "processing") stats.processing++;
        else if (aiStatus === "completed") stats.completed++;
        else if (aiStatus === "failed") stats.failed++;
      }

      if (aiStatus === "completed") {
        const trainingStatus = data.trainingStatus || "pending";
        if (trainingStatus === "approved") stats.approved++;
        else if (trainingStatus === "rejected") stats.rejected++;
        else stats.pendingApproval++;
      }

      allVideoDocs.push({ doc, aiStatus });
    });

    const allVideos = allVideoDocs
      .filter(
        ({ aiStatus }) =>
          !statusFilter || statusFilter === "all" || aiStatus === statusFilter,
      )
      .map(({ doc, aiStatus }) => {
        const data = doc.data();
        return {
          id: doc.id,
          fileName: extractFileName(data),
          url: data.videoUrl || data.storageUrl || data.url || "",
          thumbnailUrl: data.thumbnailUrl || data.thumbnail || null,
          locationId: data.locationId || null,
          roomId: data.roomId || null,
          targetId: data.targetId || null,
          actionId: data.actionId || null,
          userId: data.userId || data.contributorId || null,
          source: data.source || null,
          reviewStatus: data.reviewStatus || null,
          blurStatus: data.blurStatus || null,
          blurredUrl: data.blurredUrl || null,
          importSource: data.importSource || null,
          uploadedAt:
            parseFirestoreTimestamp(data.uploadedAt) ||
            parseFirestoreTimestamp(data.createdAt) ||
            parseFirestoreTimestamp(data.timestamp),
          aiStatus,
          aiAnnotations: data.aiAnnotations || data.annotations || null,
          aiError: data.aiError || data.annotationError || null,
          duration:
            data.durationSeconds || data.duration || data.videoDuration || null,
          size: data.fileSize || data.size || null,
          aiRoomType: data.aiRoomType || null,
          aiActionTypes: data.aiActionTypes || [],
          aiObjectLabels: data.aiObjectLabels || [],
          aiQualityScore: data.aiQualityScore || null,
          trainingStatus: data.trainingStatus || "pending",
          faceDetectionStatus: data.faceDetectionStatus ?? null,
          hasFaces: data.hasFaces ?? null,
          faceCount: data.faceCount ?? 0,
          faceTimestamps: data.faceTimestamps ?? null,
          faceDetectionError: data.faceDetectionError ?? null,
          contributorName: data.contributorName || null,
          contributorType: data.contributorType || null,
          contributorId: data.contributorId || null,
          contributorOrgId: data.contributorOrgId || null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          recordedAt: parseFirestoreTimestamp(data.recordedAt),
          recordingEndedAt: parseFirestoreTimestamp(data.recordingEndedAt),
        };
      });

    allVideos.sort((a, b) => {
      const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      return dateB - dateA;
    });

    const paginatedVideos = allVideos.slice(offset, offset + limit);

    const locationIds = [
      ...new Set(paginatedVideos.map((v) => v.locationId).filter(Boolean)),
    ];
    const locationMap = new Map<string, string>();

    await Promise.all(
      locationIds.map(async (locId) => {
        try {
          const locationDoc = await adminDb
            .collection("locations")
            .doc(locId)
            .get();
          if (locationDoc.exists) {
            const locData = locationDoc.data();
            locationMap.set(locId, locData?.name || locData?.address || locId);
          }
        } catch {}
      }),
    );

    const videosWithLocations = paginatedVideos.map((video) => ({
      ...video,
      locationName: video.locationId
        ? locationMap.get(video.locationId) || null
        : null,
    }));

    return NextResponse.json({
      videos: videosWithLocations,
      stats,
      pagination: {
        total: allVideos.length,
        limit,
        offset,
        hasMore: offset + limit < allVideos.length,
      },
    });
  } catch (error: any) {
    console.error("[API] Videos list error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch videos" },
      { status: 500 },
    );
  }
}
