import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

/**
 * Get Videos for a Job (Task)
 * GET /api/robot/jobs/{id}/videos
 *
 * Note: "Jobs" in SQL are synced from Firestore "tasks"
 * This endpoint queries Firestore directly (source of truth)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Auth check
    const apiKey = request.headers.get("X-Robot-API-Key");
    if (!apiKey || apiKey !== process.env.ROBOT_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing API key" },
        { status: 401 },
      );
    }

    const jobId = params.id;

    // Verify job (task) exists in Firestore
    // Check both root tasks collection and location subcollections
    let taskDoc = await adminDb.collection("tasks").doc(jobId).get();
    let taskTitle = null;

    if (taskDoc.exists) {
      const taskData = taskDoc.data();
      taskTitle = taskData?.title || taskData?.name || null;
    } else {
      // Try to find in location subcollections (legacy structure)
      const locationsSnapshot = await adminDb
        .collection("locations")
        .limit(100)
        .get();

      for (const locDoc of locationsSnapshot.docs) {
        const taskRef = locDoc.ref.collection("tasks").doc(jobId);
        taskDoc = await taskRef.get();
        if (taskDoc.exists) {
          const taskData = taskDoc.data();
          taskTitle = taskData?.title || taskData?.name || null;
          break;
        }
      }
    }

    if (!taskDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 },
      );
    }

    // Get all videos for this job/task from Firestore
    // Media is linked to tasks via taskId field
    const mediaQuery: FirebaseFirestore.Query = adminDb
      .collection("media")
      .where("taskId", "==", jobId);

    // Also check for jobId field (some media might use jobId instead of taskId)
    const mediaSnapshot = await mediaQuery.get();

    // If no results with taskId, try jobId
    const videos: any[] = [];

    if (mediaSnapshot.empty) {
      const jobIdQuery = await adminDb
        .collection("media")
        .where("jobId", "==", jobId)
        .get();

      jobIdQuery.docs.forEach((doc) => {
        const data = doc.data();
        if (data.mediaType === "video" || data.mimeType?.startsWith("video/")) {
          videos.push({
            id: doc.id,
            storage_url: data.storageUrl || data.url || data.videoUrl || null,
            thumbnail_url: data.thumbnailUrl || data.thumbnail || null,
            duration_seconds: data.durationSeconds || data.duration || null,
            file_size_bytes: data.fileSize || data.size || null,
            media_type: data.mediaType || data.mimeType || "video",
            uploaded_at:
              data.uploadedAt?.toDate?.()?.toISOString() ||
              data.createdAt?.toDate?.()?.toISOString() ||
              null,
            uploaded_by: data.uploadedBy || data.uploaded_by || null,
            task_id: jobId,
            task_title: taskTitle,
            media_role: "instruction", // Default
            time_offset_seconds: null,
          });
        }
      });
    } else {
      mediaSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.mediaType === "video" || data.mimeType?.startsWith("video/")) {
          videos.push({
            id: doc.id,
            storage_url: data.storageUrl || data.url || data.videoUrl || null,
            thumbnail_url: data.thumbnailUrl || data.thumbnail || null,
            duration_seconds: data.durationSeconds || data.duration || null,
            file_size_bytes: data.fileSize || data.size || null,
            media_type: data.mediaType || data.mimeType || "video",
            uploaded_at:
              data.uploadedAt?.toDate?.()?.toISOString() ||
              data.createdAt?.toDate?.()?.toISOString() ||
              null,
            uploaded_by: data.uploadedBy || data.uploaded_by || null,
            task_id: jobId,
            task_title: taskTitle,
            media_role: "instruction", // Default
            time_offset_seconds: null,
          });
        }
      });
    }

    // Sort by uploaded_at (newest first)
    videos.sort((a, b) => {
      const dateA = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
      const dateB = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({
      success: true,
      job_id: jobId,
      job_title: taskTitle || "Unnamed Job",
      videos,
      total: videos.length,
    });
  } catch (error: any) {
    console.error("Robot job videos API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: error.message,
      },
      { status: 500 },
    );
  }
}
