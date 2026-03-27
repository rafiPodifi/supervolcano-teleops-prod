/**
 * MIGRATION: Fix stuck video uploads
 * 
 * Finds all media docs where:
 * - status = "uploading"
 * - storagePath exists
 * - url is missing/empty
 * 
 * For each doc:
 * - Verifies file exists in Storage
 * - Gets download URL
 * - Updates Firestore with url and status="completed"
 * 
 * ONE-TIME USE - DELETE AFTER RUNNING
 */
import { NextResponse } from "next/server";
import { getAdminDb, getAdminStorage } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    console.log("🚀 Starting stuck uploads fix migration...");
    
    const stats = {
      analyzed: 0,
      fixed: 0,
      skipped: 0,
      notFound: 0,
      errors: [] as string[],
      details: [] as { id: string; storagePath: string; url: string }[],
    };

    const adminDb = getAdminDb();
    const adminStorage = getAdminStorage();
    const bucket = adminStorage.bucket();

    // Query all media docs with status="uploading" and storagePath exists
    console.log("📋 Querying Firestore for stuck uploads...");
    const snapshot = await adminDb
      .collection("media")
      .where("status", "==", "uploading")
      .get();

    stats.analyzed = snapshot.size;
    console.log(`Found ${stats.analyzed} docs with status="uploading"`);

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const docId = docSnapshot.id;
      const storagePath = data.storagePath;

      // Skip if no storagePath
      if (!storagePath) {
        console.log(`⏭️  Skipping ${docId}: no storagePath`);
        stats.skipped++;
        continue;
      }

      // Skip if url already exists
      if (data.url || data.videoUrl || data.storageUrl) {
        console.log(`⏭️  Skipping ${docId}: already has URL`);
        stats.skipped++;
        continue;
      }

      try {
        console.log(`\n🔍 Processing ${docId}...`);
        console.log(`   Storage path: ${storagePath}`);

        // Check if file exists in Storage
        const file = bucket.file(storagePath);
        const [exists] = await file.exists();
        
        if (!exists) {
          console.log(`   ❌ File not found in Storage`);
          stats.notFound++;
          
          // Update doc to failed status
          await adminDb.collection("media").doc(docId).update({
            status: "failed",
            error: "File not found in Storage during migration",
          });
          continue;
        }

        // Get file metadata
        const [metadata] = await file.getMetadata();
        console.log(`   ✅ File exists, size: ${metadata.size} bytes`);

        // Get download URL (signed URL with 1 year expiration)
        const [downloadURL] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
        });

        console.log(`   ✅ Download URL obtained: ${downloadURL.substring(0, 100)}...`);

        // Update Firestore doc
        await adminDb.collection("media").doc(docId).update({
          status: "completed",
          url: downloadURL,
          videoUrl: downloadURL, // Backwards compatibility
          storageUrl: downloadURL, // Also used by web
          // Update fileSize from actual Storage file if different
          fileSize: metadata.size || data.fileSize,
        });

        console.log(`   ✅ Firestore doc updated`);
        stats.fixed++;
        stats.details.push({
          id: docId,
          storagePath,
          url: downloadURL,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`   ❌ Error processing ${docId}:`, message);
        stats.errors.push(`${docId}: ${message}`);
        
        // Try to update doc to failed status
        try {
          await adminDb.collection("media").doc(docId).update({
            status: "failed",
            error: `Migration error: ${message}`,
          });
        } catch (updateError) {
          console.error(`   ❌ Failed to update doc status:`, updateError);
        }
      }
    }

    console.log("\n═══════════════════════════════════════");
    console.log("✅ Migration complete!");
    console.log("═══════════════════════════════════════");
    console.log(`Analyzed: ${stats.analyzed}`);
    console.log(`Fixed: ${stats.fixed}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Not found: ${stats.notFound}`);
    console.log(`Errors: ${stats.errors.length}`);

    return NextResponse.json({
      success: true,
      message: "Stuck uploads migration complete",
      stats,
    });
  } catch (error: unknown) {
    console.error("❌ Migration failed:", error);
    const message = error instanceof Error ? error.message : "Migration failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

