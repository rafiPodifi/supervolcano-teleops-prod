import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

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
      durationSeconds: durationSeconds || null,
      latitude: typeof latitude === "number" ? latitude : null,
      longitude: typeof longitude === "number" ? longitude : null,
      // Actual recording wall-clock times from the mobile encoder. Use these
      // (not uploadedAt) to display "when did this footage happen" in admin.
      recordedAt: recordedAt,
      recordingEndedAt: recordingEndedAt,
      uploadedBy: "oem_teleoperator", // Mobile app upload
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
