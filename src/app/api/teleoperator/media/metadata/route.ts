import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { probeMp4DurationSeconds } from "@/lib/media/mp4-duration";

export const dynamic = "force-dynamic";

/**
 * Resolve the recording cleaner's identity for attribution. Best-effort:
 * a verified bearer token wins (trusted uid); otherwise we trust the
 * body-supplied uid (unauthenticated legacy path). Returns the uid plus
 * denormalized org/role pulled from the users doc, all optional.
 */
async function resolveUploader(
  request: NextRequest,
  bodyUserId: unknown,
): Promise<{
  uploadedByUserId: string | null;
  uploadedByRole: string | null;
  organizationId: string | null;
}> {
  let uid: string | null = null;

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (token) {
    try {
      // Token verification is tenant-agnostic, so root adminAuth is safe here.
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
    } catch (error) {
      console.warn(
        "⚠️ Media metadata: token verify failed; falling back",
        error,
      );
    }
  }
  if (!uid && typeof bodyUserId === "string" && bodyUserId) {
    console.warn("⚠️ Media metadata: attributing from unverified body userId");
    uid = bodyUserId;
  }

  if (!uid) {
    return {
      uploadedByUserId: null,
      uploadedByRole: null,
      organizationId: null,
    };
  }

  let uploadedByRole: string | null = null;
  let organizationId: string | null = null;
  try {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (userDoc.exists) {
      const u = userDoc.data();
      uploadedByRole = u?.role ?? null;
      organizationId = u?.organizationId ?? null;
    }
  } catch (error) {
    console.warn("⚠️ Media metadata: failed to load user doc for", uid, error);
  }

  return { uploadedByUserId: uid, uploadedByRole, organizationId };
}

/**
 * Save media metadata to Firestore
 * Teleoperator-friendly endpoint - no auth required for mobile uploads
 * File is already uploaded to Firebase Storage by client
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      taskId, // Job/task ID
      locationId,
      mediaType,
      storageUrl,
      fileName,
      fileSize,
      mimeType,
      thumbnailUrl,
      durationSeconds,
      latitude,
      longitude,
      startedAt,
      endedAt,
      userId,
    } = body;

    // Parse ISO timestamps from the mobile client. Stored as Firestore Date
    // objects (not strings) so they sort and query as real timestamps.
    const parseIsoDate = (v: unknown): Date | null => {
      if (typeof v !== "string" || !v) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const recordedAt = parseIsoDate(startedAt);
    const recordingEndedAt = parseIsoDate(endedAt);

    console.log("📹 TELEOPERATOR MEDIA API: Received metadata request");
    console.log("📹 Task ID:", taskId);
    console.log("📹 Location ID:", locationId);
    console.log("📹 Storage URL:", storageUrl?.substring(0, 100));

    // Validate required fields. taskId is optional: a location-bound recording
    // can be uploaded before a job is chosen and assigned later on the dashboard.
    if (!locationId || !storageUrl) {
      console.error("❌ Missing required fields");
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: locationId, storageUrl",
        },
        { status: 400 },
      );
    }

    // Validate storageUrl is from Firebase Storage
    if (
      !storageUrl.includes("firebasestorage.googleapis.com") &&
      !storageUrl.includes("firebase")
    ) {
      console.error("❌ Invalid storage URL");
      return NextResponse.json(
        {
          success: false,
          error: "Invalid storage URL - must be from Firebase Storage",
        },
        { status: 400 },
      );
    }

    // Verify task exists (only when a task was supplied).
    if (taskId) {
      try {
        const taskDoc = await adminDb.collection("tasks").doc(taskId).get();
        if (!taskDoc.exists) {
          console.error("❌ Task not found:", taskId);
          return NextResponse.json(
            { success: false, error: "Task not found" },
            { status: 404 },
          );
        }
      } catch (error) {
        console.error("❌ Failed to verify task:", error);
        // Continue anyway - task might exist but query failed
      }
    }

    // Resolve who recorded this, for per-cleaner recording-hours tracking.
    const { uploadedByUserId, uploadedByRole, organizationId } =
      await resolveUploader(request, userId);

    // Determine the real encoded duration. Prefer probing the uploaded MP4
    // (the mobile encoder reports none); fall back to wall-clock from the
    // recording timestamps, then to whatever the client sent, then null.
    let resolvedDurationSeconds: number | null =
      await probeMp4DurationSeconds(storageUrl);
    if (resolvedDurationSeconds == null && recordedAt && recordingEndedAt) {
      const wallClock =
        (recordingEndedAt.getTime() - recordedAt.getTime()) / 1000;
      if (Number.isFinite(wallClock) && wallClock >= 0) {
        resolvedDurationSeconds = wallClock;
      }
    }
    if (
      resolvedDurationSeconds == null &&
      typeof durationSeconds === "number"
    ) {
      resolvedDurationSeconds = durationSeconds;
    }

    // Save metadata to Firestore
    const mediaRef = adminDb.collection("media").doc();

    await mediaRef.set({
      locationId,
      taskId: taskId ?? null, // Use taskId consistently (null when unassigned)
      jobId: taskId ?? null, // Also store as jobId for compatibility
      // True when uploaded location-only; dashboard surfaces these for job assignment.
      needsJobAssignment: !taskId,
      mediaType: mediaType || "video",
      storageUrl,
      thumbnailUrl: thumbnailUrl || null,
      fileName: fileName || "uploaded-file",
      fileSize: fileSize || 0,
      mimeType: mimeType || "video/mp4",
      durationSeconds: resolvedDurationSeconds,
      latitude: typeof latitude === "number" ? latitude : null,
      longitude: typeof longitude === "number" ? longitude : null,
      // Actual recording wall-clock times from the mobile encoder. Use these
      // (not uploadedAt) to display "when did this footage happen" in admin.
      recordedAt: recordedAt,
      recordingEndedAt: recordingEndedAt,
      uploadedBy: "oem_teleoperator", // Mobile app upload (legacy string)
      // Per-cleaner attribution for recording-hours tracking.
      uploadedByUserId,
      uploadedByRole,
      organizationId,
      uploadedAt: new Date(),
      createdAt: new Date(),
      processingStatus: "completed",
      aiProcessed: false,
      momentsExtracted: 0,
      tags: [],
    });

    console.log(`✅ Media metadata saved: ${mediaRef.id} for task ${taskId}`);

    return NextResponse.json({
      success: true,
      id: mediaRef.id,
      url: storageUrl,
      fileName: fileName || "uploaded-file",
    });
  } catch (error: any) {
    console.error("❌ Failed to save media metadata:", error);
    console.error("❌ Error details:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save metadata",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
