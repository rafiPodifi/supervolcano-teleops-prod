/**
 * ROLE AUDIT SCRIPT
 * Finds all role inconsistencies across Auth and Firestore
 * Run: npx tsx scripts/audit-roles.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
config({ path: envPath });

interface RoleIssue {
  uid: string;
  email: string;
  authRole?: string;
  firestoreRole?: string;
  issue: string;
  fix: string;
}

async function auditRoles() {
  const { adminAuth, adminDb } = await import("../src/lib/firebaseAdmin");

  console.log("🔍 Starting Role Audit...\n");
  console.log("=".repeat(70));

  const issues: RoleIssue[] = [];
  const stats = {
    totalUsers: 0,
    authOnly: 0,
    firestoreOnly: 0,
    mismatch: 0,
    fieldOperators: 0,
    teleoperators: 0,
    other: 0,
  };

  try {
    // Get all users from Auth
    const authUsers = await adminAuth.listUsers(1000);
    stats.totalUsers = authUsers.users.length;

    console.log(`📊 Found ${stats.totalUsers} users in Authentication\n`);

    for (const authUser of authUsers.users) {
      const { uid, email } = authUser;

      // Get custom claims
      const authRole = authUser.customClaims?.role as string | undefined;

      // Get Firestore document
      const firestoreDoc = await adminDb.collection("users").doc(uid).get();
      const firestoreData = firestoreDoc.data();
      const firestoreRole = firestoreData?.role as string | undefined;

      // Track stats
      if (firestoreRole === "field_operator") stats.fieldOperators++;
      if (firestoreRole === "teleoperator") stats.teleoperators++;
      if (authRole && !firestoreRole) stats.authOnly++;
      if (firestoreRole && !authRole) stats.firestoreOnly++;

      // Check for issues

      // Issue 1: Auth has role but Firestore doesn't
      if (authRole && !firestoreDoc.exists) {
        issues.push({
          uid,
          email: email || "no-email",
          authRole,
          issue: "Auth user exists but no Firestore document",
          fix: `Create Firestore document with role: ${authRole}`,
        });
      }

      // Issue 2: Auth has role but Firestore document exists without role
      if (authRole && firestoreDoc.exists && !firestoreRole) {
        issues.push({
          uid,
          email: email || "no-email",
          authRole,
          issue: "Firestore document missing role field",
          fix: `Add role: ${authRole} to Firestore document`,
        });
      }

      // Issue 3: Roles don't match
      if (authRole && firestoreRole && authRole !== firestoreRole) {
        stats.mismatch++;
        issues.push({
          uid,
          email: email || "no-email",
          authRole,
          firestoreRole,
          issue: "Role mismatch between Auth and Firestore",
          fix: `Standardize to: ${authRole} (prefer Auth as source of truth)`,
        });
      }

      // Issue 4: Firestore has role but Auth doesn't
      if (firestoreRole && !authRole) {
        stats.firestoreOnly++;
        issues.push({
          uid,
          email: email || "no-email",
          firestoreRole,
          issue: "Firestore has role but Auth custom claims missing",
          fix: `Set Auth custom claim: role = ${firestoreRole}`,
        });
      }

      // Issue 5: Test cleaner specific check
      if (
        email === "cleaner@test.com" ||
        email === "testcleaner@supervolcano.com"
      ) {
        console.log("🎯 TEST CLEANER FOUND:");
        console.log("   Email:", email);
        console.log("   UID:", uid);
        console.log("   Auth Role:", authRole || "❌ MISSING");
        console.log("   Firestore Role:", firestoreRole || "❌ MISSING");
        console.log("   Firestore Exists:", firestoreDoc.exists);

        if (firestoreDoc.exists && firestoreData) {
          console.log("   Firestore Fields:");
          console.log(
            "     - displayName:",
            firestoreData.displayName || "❌ MISSING",
          );
          console.log("     - name:", firestoreData.name || "(not set)");
          console.log(
            "     - organizationId:",
            firestoreData.organizationId || "❌ MISSING",
          );
          console.log(
            "     - partnerId:",
            firestoreData.partnerId || "❌ MISSING",
          );
        }
        console.log("");

        if (!authRole) {
          issues.push({
            uid,
            email: email || "cleaner@test.com",
            firestoreRole,
            issue: "TEST CLEANER: Missing Auth custom claim",
            fix: "Set Auth custom claim: role = field_operator",
          });
        }

        if (!firestoreRole) {
          issues.push({
            uid,
            email: email || "cleaner@test.com",
            authRole,
            issue: "TEST CLEANER: Missing Firestore role",
            fix: "Set Firestore role = field_operator",
          });
        }

        if (!firestoreData?.displayName && !firestoreData?.name) {
          issues.push({
            uid,
            email: email || "cleaner@test.com",
            authRole,
            firestoreRole,
            issue: "TEST CLEANER: Missing displayName",
            fix: 'Set displayName = "Test Cleaner"',
          });
        }

        if (!firestoreData?.organizationId) {
          issues.push({
            uid,
            email: email || "cleaner@test.com",
            authRole,
            firestoreRole,
            issue: "TEST CLEANER: Missing organizationId",
            fix: 'Set organizationId = "9a5f4710-9b1a-457c-b734-c3aed71a860a"',
          });
        }

        if (!firestoreData?.partnerId) {
          issues.push({
            uid,
            email: email || "cleaner@test.com",
            authRole,
            firestoreRole,
            issue: "TEST CLEANER: Missing partnerId",
            fix: 'Set partnerId = "demo-org"',
          });
        }
      }
    }

    // Print summary
    console.log("=".repeat(70));
    console.log("📊 AUDIT SUMMARY\n");
    console.log(`Total users: ${stats.totalUsers}`);
    console.log(`Field operators: ${stats.fieldOperators}`);
    console.log(`Teleoperators: ${stats.teleoperators}`);
    console.log(`Auth only: ${stats.authOnly}`);
    console.log(`Firestore only: ${stats.firestoreOnly}`);
    console.log(`Mismatches: ${stats.mismatch}`);
    console.log(`Total issues: ${issues.length}\n`);

    if (issues.length === 0) {
      console.log("✅ No issues found! All roles are consistent.\n");
      return;
    }

    // Print issues
    console.log("=".repeat(70));
    console.log("🔴 ISSUES FOUND\n");

    issues.forEach((issue, index) => {
      console.log(`Issue ${index + 1}:`);
      console.log(`  Email: ${issue.email}`);
      console.log(`  UID: ${issue.uid}`);
      if (issue.authRole) console.log(`  Auth Role: ${issue.authRole}`);
      if (issue.firestoreRole)
        console.log(`  Firestore Role: ${issue.firestoreRole}`);
      console.log(`  Problem: ${issue.issue}`);
      console.log(`  Fix: ${issue.fix}`);
      console.log("");
    });

    console.log("=".repeat(70));
    console.log("💡 RECOMMENDED ACTIONS\n");
    console.log("1. Review the issues above");
    console.log("2. Run the fix script: npx tsx scripts/fix-roles.ts");
    console.log("3. Or manually fix in Firebase Console\n");
  } catch (error: any) {
    console.error("Error during audit:", error.message);
  }
}

auditRoles();
