/**
 * VERIFY CLEANER ACCOUNT
 * Checks if the test cleaner account exists and has correct role
 */

import { config } from "dotenv";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
config({ path: envPath });

async function verifyCleaner() {
  const { adminAuth, adminDb } = await import("../src/lib/firebaseAdmin");

  const email = "testcleaner@supervolcano.com";

  try {
    // Check Auth user
    const user = await adminAuth.getUserByEmail(email);
    console.log("✅ Auth user exists:");
    console.log("   UID:", user.uid);
    console.log("   Email:", user.email);
    console.log("   Display Name:", user.displayName);

    // Check Firestore document
    const userDoc = await adminDb.collection("users").doc(user.uid).get();

    if (userDoc.exists) {
      const data = userDoc.data();
      console.log("\n✅ Firestore document exists:");
      console.log("   Email:", data?.email);
      console.log("   Name:", data?.name);
      console.log("   Role:", data?.role);

      if (data?.role !== "field_operator") {
        console.log('\n⚠️  WARNING: Role is not "field_operator"');
        console.log("   Current role:", data?.role);
      } else {
        console.log("\n✅ Role is correct: field_operator");
      }
    } else {
      console.log("\n❌ Firestore document does not exist!");
    }

    // Test query
    console.log("\n🔍 Testing query for field_operator users...");
    const querySnapshot = await adminDb
      .collection("users")
      .where("role", "==", "field_operator")
      .get();

    console.log(`   Found ${querySnapshot.size} field_operator user(s):`);
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`   - ${data.name || data.email} (${doc.id})`);
    });
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.code === "auth/user-not-found") {
      console.error("   User does not exist in Firebase Auth");
    }
  }
}

verifyCleaner();
