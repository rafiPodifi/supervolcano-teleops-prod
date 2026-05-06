/**
 * MIGRATION: Backfill video source tracking
 * 
 * Adds 'source' field to media documents that don't have it:
 * - 'google-drive' if importSource === 'google-drive'
 * - 'app' otherwise (default)
 * 
 * ONE-TIME USE - DELETE AFTER RUNNING
 */
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('🚀 Starting source backfill migration...');
    
    const adminDb = getAdminDb();
    const mediaRef = adminDb.collection('media');
    const snapshot = await mediaRef.get();
    
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Skip if source already set
      if (data.source) {
        skipped++;
        continue;
      }
      
      try {
        let source = 'app'; // default
        
        // Check for Google Drive import
        if (data.importSource === 'google-drive') {
          source = 'google-drive';
        }
        
        await doc.ref.update({ source });
        updated++;
        
        if (updated % 100 === 0) {
          console.log(`Progress: ${updated} updated, ${skipped} skipped`);
        }
      } catch (err: any) {
        console.error(`Error updating ${doc.id}:`, err.message);
        errors.push(doc.id);
      }
    }
    
    console.log('✅ Source backfill complete');
    console.log(`Total: ${snapshot.size}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors.length}`);
    
    return NextResponse.json({
      success: true,
      message: 'Source backfill complete',
      stats: { 
        total: snapshot.size, 
        updated, 
        skipped, 
        errors: errors.length,
        errorIds: errors.slice(0, 10) // First 10 error IDs
      }
    });
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Migration failed' },
      { status: 500 }
    );
  }
}

