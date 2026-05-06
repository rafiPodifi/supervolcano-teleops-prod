/**
 * Migration script: properties → locations
 * 
 * This script migrates:
 * 1. properties collection → locations collection
 * 2. propertyId fields → locationId in tasks, sessions, locationNotes
 * 3. Storage paths from /properties/ → /locations/
 * 
 * Run with: npx tsx scripts/migrate-to-locations.ts
 * Or deploy as a Cloud Function for one-time execution
 */

import { initializeApp, cert, getApps, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Initialize Firebase Admin
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try multiple possible paths for service account
const possiblePaths = [
  join(__dirname, "..", "..", "super-volcano-oem-portal-firebase-adminsdk-fbsvc-9afc946529.json"),
  join(process.cwd(), "..", "super-volcano-oem-portal-firebase-adminsdk-fbsvc-9afc946529.json"),
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
].filter(Boolean) as string[];

let serviceAccount: ServiceAccount | undefined;

for (const serviceAccountPath of possiblePaths) {
  try {
    if (serviceAccountPath && readFileSync(serviceAccountPath, "utf8")) {
      const serviceAccountData = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
      serviceAccount = serviceAccountData;
      console.log(`✅ Found service account at: ${serviceAccountPath}`);
      break;
    }
  } catch {
    // Try next path
  }
}

if (!serviceAccount) {
  console.error("❌ Service account file not found. Tried:");
  possiblePaths.forEach((p) => console.error(`   - ${p}`));
  console.error("\nPlease:");
  console.error("   1. Place the service account JSON in one of the paths above, OR");
  console.error("   2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable");
  process.exit(1);
}

if (getApps().length === 0) {
  // ServiceAccount type uses projectId, but JSON has project_id
  const projectId = (serviceAccount as any).projectId || (serviceAccount as any).project_id;
  initializeApp({
    credential: cert(serviceAccount),
    projectId,
  });
}

const db = getFirestore();
const storage = getStorage();

const projectId = (serviceAccount as any).projectId || (serviceAccount as any).project_id;
console.log(`📎 Connected to Firestore project: ${projectId}`);

interface MigrationStats {
  locationsMigrated: number;
  tasksUpdated: number;
  sessionsUpdated: number;
  notesUpdated: number;
  storagePathsUpdated: number;
  errors: Array<{ type: string; id: string; error: string }>;
}

async function migratePropertiesToLocations(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    locationsMigrated: 0,
    tasksUpdated: 0,
    sessionsUpdated: 0,
    notesUpdated: 0,
    storagePathsUpdated: 0,
    errors: [],
  };

  console.log("🚀 Starting migration: properties → locations\n");

  // Skip connection test - just proceed with migration and handle errors as we go
  console.log("ℹ️  Proceeding with migration. Collections will be migrated if they exist.\n");

  // Firestore batch limit is 500 operations
  const maxBatchSize = 500;

  try {
    // Step 1: Migrate properties collection to locations
    console.log("📦 Step 1: Migrating properties → locations...");
    let propertiesSnapshot;
    try {
      propertiesSnapshot = await db.collection("properties").get();
    } catch (error: any) {
      if (error?.code === 5 || error?.code === 'NOT_FOUND') {
        console.log("   ℹ️  'properties' collection doesn't exist yet. Nothing to migrate.");
        propertiesSnapshot = { empty: true, docs: [] } as any;
      } else {
        throw error;
      }
    }
    
    if (propertiesSnapshot.empty) {
      console.log("   No properties found to migrate.");
    } else {
      const batch = db.batch();
      let batchCount = 0;

      for (const doc of propertiesSnapshot.docs) {
        try {
          const data = doc.data();
          const locationRef = db.collection("locations").doc(doc.id);
          
          // Copy document to locations collection
          batch.set(locationRef, data);
          batchCount++;
          stats.locationsMigrated++;

          // Commit batch if it reaches max size
          if (batchCount >= maxBatchSize) {
            await batch.commit();
            console.log(`   ✅ Migrated batch of ${batchCount} locations`);
            batchCount = 0;
          }
        } catch (error) {
          stats.errors.push({
            type: "property",
            id: doc.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Commit remaining documents
      if (batchCount > 0) {
        await batch.commit();
        console.log(`   ✅ Migrated final batch of ${batchCount} locations`);
      }

      console.log(`   ✅ Total locations migrated: ${stats.locationsMigrated}\n`);
    }

    // Step 2: Update tasks collection
    console.log("📋 Step 2: Updating tasks (propertyId → locationId)...");
    let tasksSnapshot;
    try {
      tasksSnapshot = await db.collection("tasks").get();
    } catch (error) {
      if ((error as any)?.code === 5 || (error as any)?.code === 'NOT_FOUND') {
        console.log("   ℹ️  'tasks' collection doesn't exist yet. Nothing to update.");
        tasksSnapshot = { empty: true, docs: [] } as any;
      } else {
        throw error;
      }
    }
    
    if (tasksSnapshot.empty) {
      console.log("   No tasks found to update.");
    } else {
      const batch = db.batch();
      let batchCount = 0;

      for (const doc of tasksSnapshot.docs) {
        try {
          const data = doc.data();
          if (data.propertyId && !data.locationId) {
            const taskRef = db.collection("tasks").doc(doc.id);
            batch.update(taskRef, {
              locationId: data.propertyId,
            });
            batchCount++;
            stats.tasksUpdated++;

            if (batchCount >= maxBatchSize) {
              await batch.commit();
              console.log(`   ✅ Updated batch of ${batchCount} tasks`);
              batchCount = 0;
            }
          }
        } catch (error) {
          stats.errors.push({
            type: "task",
            id: doc.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (batchCount > 0) {
        await batch.commit();
        console.log(`   ✅ Updated final batch of ${batchCount} tasks`);
      }

      console.log(`   ✅ Total tasks updated: ${stats.tasksUpdated}\n`);
    }

    // Step 3: Update sessions collection
    console.log("🎬 Step 3: Updating sessions (propertyId → locationId)...");
    let sessionsSnapshot;
    try {
      sessionsSnapshot = await db.collection("sessions").get();
    } catch (error) {
      if ((error as any)?.code === 5 || (error as any)?.code === 'NOT_FOUND') {
        console.log("   ℹ️  'sessions' collection doesn't exist yet. Nothing to update.");
        sessionsSnapshot = { empty: true, docs: [] } as any;
      } else {
        throw error;
      }
    }
    
    if (sessionsSnapshot.empty) {
      console.log("   No sessions found to update.");
    } else {
      const batch = db.batch();
      let batchCount = 0;

      for (const doc of sessionsSnapshot.docs) {
        try {
          const data = doc.data();
          if (data.propertyId && !data.locationId) {
            const sessionRef = db.collection("sessions").doc(doc.id);
            batch.update(sessionRef, {
              locationId: data.propertyId,
            });
            batchCount++;
            stats.sessionsUpdated++;

            if (batchCount >= maxBatchSize) {
              await batch.commit();
              console.log(`   ✅ Updated batch of ${batchCount} sessions`);
              batchCount = 0;
            }
          }
        } catch (error) {
          stats.errors.push({
            type: "session",
            id: doc.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (batchCount > 0) {
        await batch.commit();
        console.log(`   ✅ Updated final batch of ${batchCount} sessions`);
      }

      console.log(`   ✅ Total sessions updated: ${stats.sessionsUpdated}\n`);
    }

    // Step 4: Migrate propertyNotes to locationNotes
    console.log("📝 Step 4: Migrating propertyNotes → locationNotes...");
    let notesSnapshot;
    try {
      notesSnapshot = await db.collection("propertyNotes").get();
    } catch (error) {
      if ((error as any)?.code === 5 || (error as any)?.code === 'NOT_FOUND') {
        console.log("   ℹ️  'propertyNotes' collection doesn't exist yet. Nothing to migrate.");
        notesSnapshot = { empty: true, docs: [] } as any;
      } else {
        throw error;
      }
    }
    
    if (notesSnapshot.empty) {
      console.log("   No notes found to migrate.");
    } else {
      const batch = db.batch();
      let batchCount = 0;

      for (const doc of notesSnapshot.docs) {
        try {
          const data = doc.data();
          const noteRef = db.collection("locationNotes").doc(doc.id);
          
          // Update propertyId to locationId in the data
          const updatedData = { ...data };
          if (updatedData.propertyId && !updatedData.locationId) {
            updatedData.locationId = updatedData.propertyId;
            delete updatedData.propertyId;
          }
          
          batch.set(noteRef, updatedData);
          batchCount++;
          stats.notesUpdated++;

          if (batchCount >= maxBatchSize) {
            await batch.commit();
            console.log(`   ✅ Migrated batch of ${batchCount} notes`);
            batchCount = 0;
          }
        } catch (error) {
          stats.errors.push({
            type: "note",
            id: doc.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (batchCount > 0) {
        await batch.commit();
        console.log(`   ✅ Migrated final batch of ${batchCount} notes`);
      }

      console.log(`   ✅ Total notes migrated: ${stats.notesUpdated}\n`);
    }

    // Step 5: Update storage paths (if needed)
    console.log("📁 Step 5: Checking storage paths...");
    // Note: Storage path migration is complex and may require manual intervention
    // This is a placeholder - you may need to handle this separately
    console.log("   ⚠️  Storage path migration requires manual review.");
    console.log("   Update storage paths from /properties/ to /locations/ in your storage bucket.\n");

    console.log("✅ Migration completed!\n");
    console.log("📊 Summary:");
    console.log(`   Locations migrated: ${stats.locationsMigrated}`);
    console.log(`   Tasks updated: ${stats.tasksUpdated}`);
    console.log(`   Sessions updated: ${stats.sessionsUpdated}`);
    console.log(`   Notes migrated: ${stats.notesUpdated}`);
    console.log(`   Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log("\n❌ Errors encountered:");
      stats.errors.forEach((err) => {
        console.log(`   ${err.type} ${err.id}: ${err.error}`);
      });
    }

    // Step 6: Optional - Delete old collections (commented out for safety)
    console.log("\n⚠️  IMPORTANT: Old collections still exist.");
    console.log("   After verifying the migration, you can manually delete:");
    console.log("   - properties collection");
    console.log("   - propertyNotes collection");
    console.log("   (Only do this after confirming everything works!)");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }

  return stats;
}

// Run migration
const isMainModule = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes("migrate-to-locations");

if (isMainModule) {
  migratePropertiesToLocations()
    .then(() => {
      console.log("\n✅ Migration script completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Migration script failed:", error);
      process.exit(1);
    });
}

export { migratePropertiesToLocations };

