/**
 * CREATE TEST CLEANER SCRIPT
 * Creates test cleaner account with correct credentials and role
 * Run: npx tsx scripts/create-cleaner-test.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
config({ path: envPath });

async function createTestCleaner() {
  const { adminAuth, adminDb } = await import("../src/lib/firebaseAdmin");
  const { FieldValue } = await import("firebase-admin/firestore");

  console.log("🔧 Creating Test Cleaner Account...\n");

  const email = "cleaner@test.com";
  const password = "Test123!";

  try {
    // Check if user already exists
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
      console.log("✅ User already exists in Auth");
      console.log("   UID:", userRecord.uid);
      console.log("   Email:", userRecord.email);

      // Update password
      await adminAuth.updateUser(userRecord.uid, { password });
      console.log("   Password updated to: Test123!");
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        // Create new user
        console.log("📝 Creating new Auth user...");
        userRecord = await adminAuth.createUser({
          email,
          password,
          displayName: "Test Cleaner",
        });
        console.log("✅ Auth user created");
        console.log("   UID:", userRecord.uid);
        console.log("   Email:", userRecord.email);
      } else {
        throw error;
      }
    }

    // Set custom claims
    console.log("📝 Setting Auth custom claims...");
    await adminAuth.setCustomUserClaims(userRecord.uid, {
      role: "field_operator",
    });
    console.log("✅ Custom claims set: role = field_operator");

    // Create/update Firestore document
    const firestoreDoc = await adminDb
      .collection("users")
      .doc(userRecord.uid)
      .get();

    const userData = {
      email,
      displayName: "Test Cleaner",
      role: "field_operator",
      organizationId: "9a5f4710-9b1a-457c-b734-c3aed71a860a",
      partnerId: "demo-org",
      teleoperatorId: null,
      updated_at: FieldValue.serverTimestamp(),
    };

    if (firestoreDoc.exists) {
      console.log("📝 Updating existing Firestore document...");
      await adminDb.collection("users").doc(userRecord.uid).update(userData);
      console.log("✅ Firestore document updated");
    } else {
      console.log("📝 Creating new Firestore document...");
      await adminDb
        .collection("users")
        .doc(userRecord.uid)
        .set({
          ...userData,
          created_at: FieldValue.serverTimestamp(),
        });
      console.log("✅ Firestore document created");
    }

    // Summary
    console.log("");
    console.log("=".repeat(70));
    console.log("🎉 TEST CLEANER READY!\n");
    console.log("Credentials:");
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log("");
    console.log("Configuration:");
    console.log(`  UID: ${userRecord.uid}`);
    console.log(`  Role: field_operator`);
    console.log(`  Organization ID: 9a5f4710-9b1a-457c-b734-c3aed71a860a`);
    console.log(`  Partner ID: demo-org`);
    console.log("");
    console.log("Test in:");
    console.log("  1. Web portal → Locations → Assignments → Assign Cleaner");
    console.log("  2. Mobile app → Login → See assigned locations");
    console.log("=".repeat(70));
    console.log("");
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error);
  }
}

createTestCleaner();
