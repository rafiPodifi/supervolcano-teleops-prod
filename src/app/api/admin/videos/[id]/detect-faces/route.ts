import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { VideoIntelligenceServiceClient } from "@google-cloud/video-intelligence";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min timeout for video processing

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const db = getAdminDb();
    const docRef = db.collection("media").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const data = doc.data();
    const videoUrl = data?.url || data?.storageUrl || data?.videoUrl;

    if (!videoUrl) {
      return NextResponse.json({ error: "No video URL" }, { status: 400 });
    }

    // Update status to processing
    await docRef.update({
      faceDetectionStatus: "processing",
      updatedAt: new Date(),
    });

    const client = new VideoIntelligenceServiceClient();

    // Convert Firebase Storage URL to GCS URI using same pattern as video-blur.service.ts
    const firebaseUrlToGcsUri = (firebaseUrl: string): string | null => {
      try {
        const googleapisMatch = firebaseUrl.match(
          /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?]+)/,
        );
        if (googleapisMatch) {
          const bucket = googleapisMatch[1];
          const path = decodeURIComponent(googleapisMatch[2]);
          return `gs://${bucket}/${path}`;
        }

        const storageMatch = firebaseUrl.match(
          /https:\/\/storage\.googleapis\.com\/([^/]+)\/(.+)/,
        );
        if (storageMatch) {
          const bucket = storageMatch[1];
          const path = storageMatch[2].split("?")[0];
          return `gs://${bucket}/${path}`;
        }

        const newFormatMatch = firebaseUrl.match(
          /https:\/\/([^.]+\.firebasestorage\.app)\/o\/([^?]+)/,
        );
        if (newFormatMatch) {
          const bucket = newFormatMatch[1];
          const path = decodeURIComponent(newFormatMatch[2]);
          return `gs://${bucket}/${path}`;
        }

        return null;
      } catch (error) {
        console.error("[FaceDetection] Failed to parse Firebase URL:", error);
        return null;
      }
    };

    const gcsUri = firebaseUrlToGcsUri(videoUrl) || videoUrl;

    const [operation] = await client.annotateVideo({
      inputUri: gcsUri,
      features: ["FACE_DETECTION" as any],
      videoContext: {
        faceDetectionConfig: {
          includeBoundingBoxes: true,
          includeAttributes: false,
        },
      },
    });

    const [response] = await operation.promise();

    const faceAnnotations =
      response.annotationResults?.[0]?.faceDetectionAnnotations || [];
    const hasFaces = faceAnnotations.length > 0;
    const faceCount = faceAnnotations.length;

    // Extract face timestamps if faces found
    const faceTimestamps = faceAnnotations
      .map((face) => {
        const tracks = face.tracks || [];
        if (tracks.length > 0) {
          const segment = tracks[0].segment;
          const startSeconds = segment?.startTimeOffset?.seconds
            ? parseFloat(segment.startTimeOffset.seconds.toString())
            : 0;
          const endSeconds = segment?.endTimeOffset?.seconds
            ? parseFloat(segment.endTimeOffset.seconds.toString())
            : 0;
          return {
            startTime: startSeconds,
            endTime: endSeconds,
          };
        }
        return null;
      })
      .filter(
        (ts): ts is { startTime: number; endTime: number } => ts !== null,
      );

    // Update Firestore with results
    await docRef.update({
      faceDetectionStatus: "completed",
      hasFaces,
      faceCount,
      faceTimestamps: faceTimestamps.length > 0 ? faceTimestamps : null,
      faceDetectedAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      hasFaces,
      faceCount,
    });
  } catch (error: any) {
    console.error("Face detection error:", error);

    // Update status to failed
    try {
      const db = getAdminDb();
      await db
        .collection("media")
        .doc(params.id)
        .update({
          faceDetectionStatus: "failed",
          faceDetectionError:
            error instanceof Error ? error.message : "Unknown error",
          updatedAt: new Date(),
        });
    } catch (updateError) {
      console.error("Failed to update error status:", updateError);
    }

    return NextResponse.json(
      {
        error: "Face detection failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
