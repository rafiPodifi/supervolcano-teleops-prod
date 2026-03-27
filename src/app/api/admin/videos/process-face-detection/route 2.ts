import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { VideoIntelligenceServiceClient } from '@google-cloud/video-intelligence';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  try {
    const db = getAdminDb();
    
    // Get pending videos
    const snapshot = await db.collection('media')
      .where('faceDetectionStatus', '==', 'pending')
      .limit(5) // Process 5 at a time
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ 
        success: true,
        message: 'No pending videos', 
        processed: 0 
      });
    }

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase Admin credentials for Video Intelligence');
    }

    const client = new VideoIntelligenceServiceClient({
      credentials: { client_email: clientEmail, private_key: privateKey },
      projectId,
    });
    
    const results = { processed: 0, failed: 0, errors: [] as string[] };

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const videoUrl = data.url || data.storageUrl || data.videoUrl;
      
      if (!videoUrl) {
        results.failed++;
        await doc.ref.update({ 
          faceDetectionStatus: 'failed',
          faceDetectionError: 'No video URL found',
          updatedAt: new Date(),
        });
        continue;
      }

      try {
        await doc.ref.update({ 
          faceDetectionStatus: 'processing',
          updatedAt: new Date(),
        });

        // Convert Firebase Storage URL to GCS URI using same pattern as video-blur.service.ts
        const firebaseUrlToGcsUri = (firebaseUrl: string): string | null => {
          try {
            const googleapisMatch = firebaseUrl.match(
              /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?]+)/
            );
            if (googleapisMatch) {
              const bucket = googleapisMatch[1];
              const path = decodeURIComponent(googleapisMatch[2]);
              return `gs://${bucket}/${path}`;
            }

            const storageMatch = firebaseUrl.match(
              /https:\/\/storage\.googleapis\.com\/([^/]+)\/(.+)/
            );
            if (storageMatch) {
              const bucket = storageMatch[1];
              const path = storageMatch[2].split('?')[0];
              return `gs://${bucket}/${path}`;
            }

            const newFormatMatch = firebaseUrl.match(
              /https:\/\/([^.]+\.firebasestorage\.app)\/o\/([^?]+)/
            );
            if (newFormatMatch) {
              const bucket = newFormatMatch[1];
              const path = decodeURIComponent(newFormatMatch[2]);
              return `gs://${bucket}/${path}`;
            }

            return null;
          } catch (error) {
            console.error('[FaceDetection] Failed to parse Firebase URL:', error);
            return null;
          }
        };

        const gcsUri = firebaseUrlToGcsUri(videoUrl) || videoUrl;

        const [operation] = await client.annotateVideo({
          inputUri: gcsUri,
          features: ['FACE_DETECTION' as any],
          videoContext: {
            faceDetectionConfig: {
              includeBoundingBoxes: true,
              includeAttributes: false,
            },
          },
        });

        const [response] = await operation.promise();
        const faceAnnotations = response.annotationResults?.[0]?.faceDetectionAnnotations || [];
        
        // Extract face timestamps
        const faceTimestamps = faceAnnotations.map(face => {
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
        }).filter((ts): ts is { startTime: number; endTime: number } => ts !== null);
        
        await doc.ref.update({
          faceDetectionStatus: 'completed',
          hasFaces: faceAnnotations.length > 0,
          faceCount: faceAnnotations.length,
          faceTimestamps: faceTimestamps.length > 0 ? faceTimestamps : null,
          faceDetectedAt: new Date(),
          updatedAt: new Date(),
        });

        results.processed++;
      } catch (err: any) {
        console.error(`Face detection failed for ${doc.id}:`, err);
        results.failed++;
        results.errors.push(doc.id);
        await doc.ref.update({ 
          faceDetectionStatus: 'failed',
          faceDetectionError: err instanceof Error ? err.message : 'Unknown error',
          updatedAt: new Date(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.processed,
      failed: results.failed,
      errors: results.errors,
      remaining: snapshot.size - results.processed - results.failed,
    });

  } catch (error: any) {
    console.error('Processing face detection error:', error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed' 
    }, { status: 500 });
  }
}

