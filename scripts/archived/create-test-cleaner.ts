/**
 * CREATE TEST CLEANER ACCOUNT
 * Creates a test cleaner (field_operator) account in Firebase Auth and Firestore
 *
 * Usage: npx tsx scripts/create-test-cleaner.ts
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
  console.error("❌ Missing required environment variables:");
  missingVars.forEach((varName) => console.error(`   - ${varName}`));
  console.error(
    "\n💡 Make sure .env.local exists and contains all FIREBASE_ADMIN_* variables.",
  );
  process.exit(1);
}

console.log("✅ Environment variables loaded successfully\n");

async function createTestCleaner() {
  try {
    console.log("🔧 Creating test cleaner account...");

    // Dynamically import Firebase Admin AFTER env vars are loaded
    const { adminAuth, adminDb } = await import("../src/lib/firebaseAdmin");
    const { FieldValue } = await import("firebase-admin/firestore");

    const email = "testcleaner@supervolcano.com";
    const password = "Test123!,";
    const name = "Test Cleaner";
    const role = "field_operator";

    // Check if user already exists
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
      console.log("⚠️  User already exists with email:", email);
      console.log("   UID:", userRecord.uid);

      // Update password if user exists
      await adminAuth.updateUser(userRecord.uid, {
        password,
      });
      console.log("✅ Password updated");
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        // User doesn't exist, create it
        console.log("📝 Creating new auth user...");
        userRecord = await adminAuth.createUser({
          email,
          password,
          displayName: name,
          emailVerified: true,
        });
        console.log("✅ Auth user created:", userRecord.uid);
      } else {
        throw error;
      }
    }

    // Check if Firestore document exists
    const userDocRef = adminDb.collection("users").doc(userRecord.uid);
    const userDoc = await userDocRef.get();

    if (userDoc.exists) {
      console.log("⚠️  Firestore document already exists");
      console.log("   Updating existing document...");
      await userDocRef.update({
        email,
        name,
        role,
        updated_at: FieldValue.serverTimestamp(),
      });
      console.log("✅ Firestore document updated");
    } else {
      console.log("📝 Creating Firestore document...");
      await userDocRef.set({
        email,
        name,
        role,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      console.log("✅ Firestore document created");
    }

    console.log("\n✅ Test cleaner account ready!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 Email:", email);
    console.log("🔑 Password:", password);
    console.log("👤 Name:", name);
    console.log("🎭 Role:", role);
    console.log("🆔 UID:", userRecord.uid);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error creating test cleaner:", error);
    console.error("   Error code:", error.code);
    console.error("   Error message:", error.message);
    process.exit(1);
  }
}

createTestCleaner();
