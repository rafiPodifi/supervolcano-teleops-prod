/**
 * MIGRATION: Split field_operator into explicit roles
 * Analyzes organizationId prefix to determine correct new role
 * DELETE AFTER SUCCESSFUL EXECUTION
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function GET() {
  try {
    console.log("🚀 Starting field_operator role split migration...");

    const stats = {
      usersAnalyzed: 0,
      usersUpdated: 0,
      authUpdated: 0,
      errors: [] as Array<{
        uid: string;
        email?: string;
        error: string;
      }>,
    };

    // Get all users with field_operator role
    const usersSnapshot = await adminDb
      .collection("users")
      .where("role", "==", "field_operator")
      .get();

    console.log(
      `Found ${usersSnapshot.size} field_operator users to migrate`,
    );

    for (const userDoc of usersSnapshot.docs) {
      stats.usersAnalyzed++;

      const userData = userDoc.data();
      const orgId = userData.organizationId || "";

      try {
        // Determine new role based on organization prefix
        let newRole: string;

        if (orgId.startsWith("oem:")) {
          newRole = "oem_teleoperator";
        } else if (orgId.startsWith("owner:")) {
          newRole = "location_cleaner";
        } else {
          // Default to property_cleaner for backward compatibility
          newRole = "location_cleaner";
          console.warn(
            `  ⚠️  User ${userData.email} has ambiguous orgId: ${orgId}, defaulting to property_cleaner`,
          );
        }

        // Update Firestore
        await adminDb.collection("users").doc(userDoc.id).update({
          role: newRole,
          updated_at: new Date(),
        });

        stats.usersUpdated++;
        console.log(
          `  ✓ Firestore: ${userData.email} → ${newRole}`,
        );

        // Update Auth custom claims
        const authUser = await adminAuth.getUser(userDoc.id);
        const currentClaims = authUser.customClaims || {};

        await adminAuth.setCustomUserClaims(userDoc.id, {
          ...currentClaims,
          role: newRole,
        });

        stats.authUpdated++;
        console.log(`  ✓ Auth: ${userData.email} → ${newRole}`);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        stats.errors.push({
          uid: userDoc.id,
          email: userData.email,
          error: message,
        });
        console.error(
          `  ✗ Error migrating ${userData.email}:`,
          message,
        );
      }
    }

    console.log("\n✅ Migration complete!");
    console.log(JSON.stringify(stats, null, 2));

    return NextResponse.json({
      success: true,
      message: "field_operator role split completed",
      stats,
    });
  } catch (error: unknown) {
    console.error("💥 Migration failed:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

