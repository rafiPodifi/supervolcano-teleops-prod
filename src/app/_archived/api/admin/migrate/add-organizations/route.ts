/**
 * ONE-TIME MIGRATION: Create Organizations Collection
 * Analyzes existing organizationId values and creates organization records
 * DELETE AFTER RUNNING SUCCESSFULLY
 */

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { generateOrganizationId } from "@/types/organization.types";

export async function GET() {
  try {
    console.log("🚀 Starting organizations migration...");

    const stats = {
      organizationsCreated: 0,
      usersUpdated: 0,
      locationsUpdated: 0,
      errors: [] as Array<{
        type: string;
        id: string;
        email?: string;
        error: string;
      }>,
    };

    // Step 1: Create default organizations
    const defaultOrgs = [
      {
        id: "sv:internal",
        name: "SuperVolcano Internal",
        type: "supervolcano" as const,
        slug: "internal",
      },
      {
        id: "oem:demo-org",
        name: "Demo Robotics Company",
        type: "oem_partner" as const,
        slug: "demo-org",
      },
    ];

    for (const org of defaultOrgs) {
      const existing = await adminDb
        .collection("organizations")
        .doc(org.id)
        .get();
      if (!existing.exists) {
        await adminDb.collection("organizations").doc(org.id).set({
          ...org,
          created_at: new Date(),
          updated_at: new Date(),
        });
        stats.organizationsCreated++;
        console.log(`✅ Created organization: ${org.name}`);
      }
    }

    // Step 2: Analyze and migrate user organizationIds
    const usersSnapshot = await adminDb.collection("users").get();

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const oldOrgId = userData.organizationId;

      if (!oldOrgId) continue;

      try {
        let newOrgId = oldOrgId;

        // If it's already prefixed, skip
        if (oldOrgId.match(/^(sv|oem|owner):/)) {
          console.log(
            `  ⏭️  User ${userData.email} already has prefixed org ID`,
          );
          continue;
        }

        // Determine new org ID based on role
        if (userData.role === "admin" || userData.role === "superadmin") {
          newOrgId = "sv:internal";
        } else if (oldOrgId === "demo-org" || oldOrgId.includes("demo")) {
          newOrgId = "oem:demo-org";
        } else {
          // For UUIDs or other IDs, create a location owner org
          const slug = `org-${oldOrgId.substring(0, 8)}`;
          newOrgId = `owner:${slug}`;

          // Create the organization if it doesn't exist
          const orgExists = await adminDb
            .collection("organizations")
            .doc(newOrgId)
            .get();
          if (!orgExists.exists) {
            await adminDb.collection("organizations").doc(newOrgId).set({
              name: `Organization ${slug}`,
              type: "location_owner",
              slug,
              created_at: new Date(),
              updated_at: new Date(),
            });
            stats.organizationsCreated++;
            console.log(`  ✅ Created org: ${newOrgId}`);
          }
        }

        // Update user with new org ID
        await adminDb.collection("users").doc(userDoc.id).update({
          organizationId: newOrgId,
          updated_at: new Date(),
        });
        stats.usersUpdated++;
        console.log(
          `  ✓ Updated user ${userData.email}: ${oldOrgId} → ${newOrgId}`,
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        stats.errors.push({
          type: "user",
          id: userDoc.id,
          email: userData.email,
          error: message,
        });
        console.error(
          `  ✗ Error updating user ${userData.email}:`,
          message,
        );
      }
    }

    // Step 3: Migrate location organizationIds (similar logic)
    const locationsSnapshot = await adminDb.collection("locations").get();

    for (const locationDoc of locationsSnapshot.docs) {
      const locationData = locationDoc.data();
      const oldOrgId = locationData.organizationId;

      if (!oldOrgId) continue;

      try {
        let newOrgId = oldOrgId;

        if (oldOrgId.match(/^(sv|oem|owner):/)) {
          continue;
        }

        if (oldOrgId === "demo-org" || oldOrgId.includes("demo")) {
          newOrgId = "oem:demo-org";
        } else {
          const slug = `org-${oldOrgId.substring(0, 8)}`;
          newOrgId = `owner:${slug}`;

          const orgExists = await adminDb
            .collection("organizations")
            .doc(newOrgId)
            .get();
          if (!orgExists.exists) {
            await adminDb.collection("organizations").doc(newOrgId).set({
              name: `Organization ${slug}`,
              type: "location_owner",
              slug,
              created_at: new Date(),
              updated_at: new Date(),
            });
            stats.organizationsCreated++;
          }
        }

        await adminDb.collection("locations").doc(locationDoc.id).update({
          organizationId: newOrgId,
          updated_at: new Date(),
        });
        stats.locationsUpdated++;
        console.log(
          `  ✓ Updated location ${locationData.address}: ${oldOrgId} → ${newOrgId}`,
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        stats.errors.push({
          type: "location",
          id: locationDoc.id,
          error: message,
        });
      }
    }

    console.log("\n✅ Migration complete!");
    console.log(JSON.stringify(stats, null, 2));

    return NextResponse.json({
      success: true,
      message: "Organizations migration completed",
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

