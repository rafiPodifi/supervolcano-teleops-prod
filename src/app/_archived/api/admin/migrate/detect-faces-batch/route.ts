import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  try {
    const db = getAdminDb();
    
    // Get all media documents
    const allDocs = await db.collection('media').get();
    
    // Filter videos that need face detection
    const needsScan = allDocs.docs.filter(doc => {
      const data = doc.data();
      // Skip if already has face detection status
      if (data.faceDetectionStatus) return false;
      // Only process videos with URLs
      return !!(data.url || data.storageUrl || data.videoUrl);
    });

    const results = {
      total: needsScan.length,
      queued: 0,
      errors: [] as string[],
    };

    // Queue each for face detection (fire and forget)
    for (const doc of needsScan.slice(0, 20)) { // Limit to 20 at a time
      try {
        await db.collection('media').doc(doc.id).update({
          faceDetectionStatus: 'pending',
          updatedAt: new Date(),
        });
        results.queued++;
      } catch (err: any) {
        console.error(`Error queuing ${doc.id}:`, err);
        results.errors.push(doc.id);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Queued ${results.queued} videos for face detection`,
      stats: results,
      note: results.total > 20 ? `Run again to process remaining ${results.total - 20} videos` : 'All videos queued',
    });

  } catch (error: any) {
    console.error('Batch face detection error:', error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed' 
    }, { status: 500 });
  }
}

