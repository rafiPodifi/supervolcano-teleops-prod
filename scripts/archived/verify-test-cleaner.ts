/**
 * VERIFICATION SCRIPT
 * Checks if test cleaner is properly configured
 */

import { config } from "dotenv";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
config({ path: envPath });

async function verifyTestCleaner() {
  const { adminDb } = await import("../src/lib/firebaseAdmin");

  console.log("🔍 Verifying Test Cleaner configuration...\n");

  try {
    // 1. Find test cleaner by email
    const usersSnapshot = await adminDb
      .collection("users")
      .where("email", "==", "testcleaner@supervolcano.com")
      .get();

    if (usersSnapshot.empty) {
      console.error("❌ Test Cleaner NOT FOUND in Firestore");
      console.log("Create user with email: testcleaner@supervolcano.com");
      return;
    }

    const doc = usersSnapshot.docs[0];
    const data = doc.data();

    console.log("✅ Test Cleaner found in Firestore");
    console.log("ID:", doc.id);
    console.log("\n📋 Current fields:");
    console.log(JSON.stringify(data, null, 2));

    // 2. Validate required fields
    console.log("\n🔎 Validation:");

    const checks = {
      "Has displayName": !!data.displayName,
      "Has email": !!data.email,
      "Role is field_operator": data.role === "field_operator",
      "Has organizationId": !!data.organizationId,
      "Has partnerId": !!data.partnerId,
      "Has created_at": !!data.created_at,
      "Has updated_at": !!data.updated_at,
    };

    let allValid = true;
    for (const [check, passed] of Object.entries(checks)) {
      console.log(`${passed ? "✅" : "❌"} ${check}`);
      if (!passed) allValid = false;
    }

    // 3. Check for legacy 'name' field
    if (data.name && !data.displayName) {
      console.log('\n⚠️  WARNING: Has "name" field but no "displayName"');
      console.log('   You should rename "name" to "displayName"');
    }

    // 4. Query by role to simulate API behavior
    console.log("\n🔍 Testing role query...");
    const roleQuery = await adminDb
      .collection("users")
      .where("role", "==", "field_operator")
      .get();

    const foundInRoleQuery = roleQuery.docs.some((d) => d.id === doc.id);
    console.log(
      `${foundInRoleQuery ? "✅" : "❌"} Found in role="field_operator" query`,
    );

    // 5. Check if has required org fields for filtering
    if (data.role === "field_operator") {
      const hasOrgFields = !!(data.organizationId && data.partnerId);
      console.log(`\n🔍 Organization fields check:`);
      console.log(`   organizationId: ${data.organizationId || "MISSING"}`);
      console.log(`   partnerId: ${data.partnerId || "MISSING"}`);
      console.log(
        `   ${hasOrgFields ? "✅" : "❌"} Has required org fields for API filtering`,
      );

      if (!hasOrgFields) {
        console.log(
          "\n⚠️  WARNING: Missing organization fields will cause user to be filtered out!",
        );
        console.log(
          "   The API filters field_operator users to only show those with org fields",
        );
      }
    }

    // 6. Final verdict
    console.log("\n" + "=".repeat(50));
    if (allValid && foundInRoleQuery) {
      console.log("✅ Test Cleaner is PROPERLY CONFIGURED");
      console.log("   Should appear in assignment modal");
    } else {
      console.log("❌ Test Cleaner has CONFIGURATION ISSUES");
      console.log("   Fix the issues above");
    }
    console.log("=".repeat(50));
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

verifyTestCleaner();
