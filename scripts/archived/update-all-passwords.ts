/**
 * Script to update passwords for all users of specific roles
 * Usage: npx tsx scripts/update-all-passwords.ts
 * 
 * This script will update passwords for:
 * - All teleoperators
 * - All admins/superadmins
 * - All org_managers
 * 
 * Password will be set to: Test123!
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

const missingVars = requiredVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error("❌ Missing required environment variables:", missingVars.join(", "));
  console.error("💡 Make sure .env.local contains all required Firebase Admin variables.");
  process.exit(1);
}

console.log("✅ Environment variables loaded successfully\n");

const NEW_PASSWORD = "Test123!";

async function updateAllPasswords() {
  console.log("🚀 Updating passwords for all users...\n");
  console.log(`🔐 New password: ${NEW_PASSWORD}\n`);

  // Dynamically import Firebase Admin AFTER env vars are loaded
  const { adminAuth, adminDb } = await import("../src/lib/firebaseAdmin");

  try {
    // Get all users from Firebase Authentication
    console.log("📋 Fetching all users from Firebase Authentication...");
    const listUsersResult = await adminAuth.listUsers();
    const allUsers = listUsersResult.users;
    
    console.log(`   Found ${allUsers.length} total users\n`);

    // Categorize users by role
    const teleoperators: Array<{ uid: string; email: string; role: string }> = [];
    const admins: Array<{ uid: string; email: string; role: string }> = [];
    const orgManagers: Array<{ uid: string; email: string; role: string }> = [];

    for (const user of allUsers) {
      const customClaims = user.customClaims || {};
      const role = customClaims.role as string;

      if (role === "teleoperator") {
        teleoperators.push({ uid: user.uid, email: user.email || "no-email", role });
      } else if (role === "admin" || role === "superadmin") {
        admins.push({ uid: user.uid, email: user.email || "no-email", role });
      } else if (role === "org_manager") {
        orgManagers.push({ uid: user.uid, email: user.email || "no-email", role });
      }
    }

    console.log("📊 Users by role:");
    console.log(`   Teleoperators: ${teleoperators.length}`);
    console.log(`   Admins/SuperAdmins: ${admins.length}`);
    console.log(`   Org Managers: ${orgManagers.length}\n`);

    // Update teleoperator passwords
    if (teleoperators.length > 0) {
      console.log("👤 Updating teleoperator passwords...");
      for (const teleop of teleoperators) {
        try {
          await adminAuth.updateUser(teleop.uid, {
            password: NEW_PASSWORD,
          });
          console.log(`   ✅ ${teleop.email} (${teleop.role})`);
        } catch (error: any) {
          console.error(`   ❌ Failed to update ${teleop.email}: ${error.message}`);
        }
      }
      console.log("");
    }

    // Update admin passwords
    if (admins.length > 0) {
      console.log("👔 Updating admin/superadmin passwords...");
      for (const admin of admins) {
        try {
          await adminAuth.updateUser(admin.uid, {
            password: NEW_PASSWORD,
          });
          console.log(`   ✅ ${admin.email} (${admin.role})`);
        } catch (error: any) {
          console.error(`   ❌ Failed to update ${admin.email}: ${error.message}`);
        }
      }
      console.log("");
    }

    // Update org manager passwords
    if (orgManagers.length > 0) {
      console.log("👨‍💼 Updating org manager passwords...");
      for (const manager of orgManagers) {
        try {
          await adminAuth.updateUser(manager.uid, {
            password: NEW_PASSWORD,
          });
          console.log(`   ✅ ${manager.email} (${manager.role})`);
        } catch (error: any) {
          console.error(`   ❌ Failed to update ${manager.email}: ${error.message}`);
        }
      }
      console.log("");
    }

    // Summary
    console.log("=".repeat(60));
    console.log("✅ Password update complete!");
    console.log("=".repeat(60));
    console.log(`\n📝 Updated Passwords:`);
    console.log(`   Password: ${NEW_PASSWORD}`);
    console.log(`\n📊 Summary:`);
    console.log(`   Teleoperators updated: ${teleoperators.length}`);
    console.log(`   Admins updated: ${admins.length}`);
    console.log(`   Org Managers updated: ${orgManagers.length}`);
    console.log(`\n⚠️  Users must sign out and sign back in if currently logged in.`);
    console.log("=".repeat(60) + "\n");

  } catch (error) {
    console.error("\n❌ Error updating passwords:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
      console.error("   Stack:", error.stack);
    }
    process.exit(1);
  }
}

// Run the script
updateAllPasswords()
  .then(() => {
    console.log("✨ Script complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

