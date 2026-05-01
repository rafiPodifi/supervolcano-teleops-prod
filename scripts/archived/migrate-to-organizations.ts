/**
 * Migration Script: Move from teleoperator-based to organization-based location assignment
 * 
 * This script:
 * 1. Creates a default organization for existing teleoperators
 * 2. Updates all teleoperators to belong to the default organization
 * 3. Updates locations: assignedTeleoperatorIds → assignedOrganizationId
 * 4. Updates user custom claims to include organizationId
 * 
 * Run with: npm run migrate:organizations
 */

// CRITICAL: Load environment variables FIRST, before any other imports
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local file
const envPath = resolve(process.cwd(), ".env.local");
console.log("📁 Loading environment variables from:", envPath);
const result = config({ path: envPath });

if (result.error) {
  console.error("❌ Failed to load .env.local:", result.error.message);
  console.error("💡 Make sure .env.local exists in the project root.");
  process.exit(1);
}

// Verify required env vars are loaded
const requiredVars = [
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
];

const missing = requiredVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error("❌ Missing required environment variables:", missing.join(", "));
  console.error("💡 Make sure .env.local contains all required Firebase Admin credentials.");
  process.exit(1);
}

console.log("✅ Environment variables loaded successfully\n");

// Use dynamic import for Firebase Admin after env vars are loaded
async function migrateToOrganizations() {
  // Dynamic import after env vars are loaded
  const { adminDb, adminAuth } = await import("../src/lib/firebaseAdmin");
  const { FieldValue } = await import("firebase-admin/firestore");
  console.log("🚀 Starting migration to organization-based architecture...\n");

  try {
    // Step 1: Create default organization
    console.log("Step 1: Creating default organization...");
    const defaultOrgRef = adminDb.collection("organizations").doc();
    await defaultOrgRef.set({
      name: "Default Organization",
      status: "active",
      partnerId: "demo-org", // Update this if you have a different default partner
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: "migration-script",
    });

    const defaultOrgId = defaultOrgRef.id;
    console.log(`✅ Created default organization: ${defaultOrgId}\n`);

    // Step 2: Update all teleoperators to belong to default organization
    console.log("Step 2: Updating teleoperators...");
    const teleopSnapshot = await adminDb.collection("teleoperators").get();

    let updatedTeleops = 0;
    for (const doc of teleopSnapshot.docs) {
      await doc.ref.update({
        organizationId: defaultOrgId,
        organizationName: "Default Organization",
      });
      updatedTeleops++;
    }

    console.log(`✅ Updated ${updatedTeleops} teleoperators\n`);

    // Step 3: Update locations: assignedTeleoperatorIds → assignedOrganizationId
    console.log("Step 3: Updating locations...");
    const locationsSnapshot = await adminDb.collection("locations").get();

    let updatedLocations = 0;
    for (const doc of locationsSnapshot.docs) {
      const location = doc.data();

      // If location has assigned teleoperators, assign to default org
      if (location.assignedTeleoperatorIds && location.assignedTeleoperatorIds.length > 0) {
        await doc.ref.update({
          assignedOrganizationId: defaultOrgId,
          assignedOrganizationName: "Default Organization",
          assignedTeleoperatorIds: FieldValue.delete(),
        });
        updatedLocations++;
      }
    }

    console.log(`✅ Updated ${updatedLocations} locations\n`);

    // Step 4: Update user custom claims to include organizationId
    console.log("Step 4: Updating user custom claims...");
    const usersSnapshot = await adminDb.collection("users").get();

    let updatedClaims = 0;
    for (const doc of usersSnapshot.docs) {
      const user = doc.data();
      if (user.role === "teleoperator" && user.teleoperatorId) {
        try {
          // Get current claims
          const userRecord = await adminAuth.getUser(doc.id);
          const currentClaims = userRecord.customClaims || {};

          // Update claims
          await adminAuth.setCustomUserClaims(doc.id, {
            ...currentClaims,
            organizationId: defaultOrgId,
          });

          // Update users collection
          await doc.ref.update({
            organizationId: defaultOrgId,
          });

          updatedClaims++;
        } catch (error: any) {
          console.error(`⚠️  Failed to update claims for user ${doc.id}:`, error.message);
        }
      }
    }

    console.log(`✅ Updated ${updatedClaims} user claims\n`);

    console.log("✅ Migration complete!");
    console.log("\n📋 Summary:");
    console.log(`   - Created default organization: ${defaultOrgId}`);
    console.log(`   - Updated ${updatedTeleops} teleoperators`);
    console.log(`   - Updated ${updatedLocations} locations`);
    console.log(`   - Updated ${updatedClaims} user claims`);
    console.log("\n⚠️  Note: Users will need to sign out and sign back in to get updated claims.");
  } catch (error: any) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateToOrganizations()
  .then(() => {
    console.log("\n✅ Migration script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration script failed:", error);
    process.exit(1);
  });

