/**
 * ONE-TIME MIGRATION ENDPOINT
 * Removes partnerId from all collections and Auth custom claims
 * POST /api/admin/migrate/remove-partner-id
 *
 * Security: Requires x-migration-key header
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  try {
    // ========================================================================
    // SECURITY CHECK
    // ========================================================================
    const migrationKey = request.headers.get("x-migration-key");
    const MIGRATION_SECRET = process.env.MIGRATION_SECRET_KEY;

    if (
      !MIGRATION_SECRET ||
      MIGRATION_SECRET === "CHANGE_ME_IN_ENV"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Migration secret not configured. Set MIGRATION_SECRET_KEY in environment variables.",
        },
        { status: 500 },
      );
    }

    if (migrationKey !== MIGRATION_SECRET) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Invalid migration key" },
        { status: 401 },
      );
    }

    console.log("🚀 Starting partnerId removal migration...");
    console.log("⏰ Started at:", new Date().toISOString());

    const stats = {
      usersProcessed: 0,
      usersUpdated: 0,
      locationsProcessed: 0,
      locationsUpdated: 0,
      authProcessed: 0,
      authUpdated: 0,
      organizationsMapped: 0,
      errors: [] as Array<{
        collection: string;
        id: string;
        email?: string;
        error: string;
      }>,
      startTime: Date.now(),
    };

    const organizationCache = new Map<string, string>(); // partnerId → organizationId

    // Helper: Get or fetch organization ID by partnerId/slug
    async function getOrganizationId(
      partnerId: string,
    ): Promise<string | null> {
      if (organizationCache.has(partnerId)) {
        return organizationCache.get(partnerId)!;
      }

      try {
        const orgQuery = await adminDb
          .collection("organizations")
          .where("slug", "==", partnerId)
          .limit(1)
          .get();

        if (!orgQuery.empty) {
          const orgId = orgQuery.docs[0].id;
          organizationCache.set(partnerId, orgId);
          stats.organizationsMapped++;
          return orgId;
        }
      } catch (error) {
        console.error(
          `Error fetching org for partnerId ${partnerId}:`,
          error,
        );
      }

      // Fallback: use partnerId as organizationId
      organizationCache.set(partnerId, partnerId);
      return partnerId;
    }

    // ========================================================================
    // MIGRATE USERS COLLECTION
    // ========================================================================
    console.log("\n📝 Migrating users collection...");
    const usersSnapshot = await adminDb.collection("users").get();
    console.log(`Found ${usersSnapshot.size} users to process`);

    for (const doc of usersSnapshot.docs) {
      stats.usersProcessed++;
      const data = doc.data();

      try {
        const hasPartnerId = "partnerId" in data;
        const needsOrgId = !data.organizationId && data.partnerId;

        if (hasPartnerId || needsOrgId) {
          const updates: any = {
            updated_at: new Date(),
          };

          // Ensure organizationId is set
          if (needsOrgId) {
            const orgId = await getOrganizationId(data.partnerId);
            if (orgId) {
              updates.organizationId = orgId;
              console.log(
                `  ✅ Mapped partnerId→organizationId for ${data.email || doc.id}`,
              );
            }
          }

          // Remove partnerId field
          if (hasPartnerId) {
            await adminDb.collection("users").doc(doc.id).update({
              ...updates,
              partnerId: FieldValue.delete(),
            });

            stats.usersUpdated++;
            console.log(
              `  ✓ Removed partnerId from user: ${data.email || doc.id}`,
            );
          } else if (Object.keys(updates).length > 1) {
            // Only updated_at and organizationId
            await adminDb.collection("users").doc(doc.id).update(updates);

            stats.usersUpdated++;
            console.log(
              `  ✓ Updated organizationId for user: ${data.email || doc.id}`,
            );
          }
        }
      } catch (error: any) {
        stats.errors.push({
          collection: "users",
          id: doc.id,
          email: data.email,
          error: error.message,
        });
        console.error(
          `  ✗ Error updating user ${data.email || doc.id}:`,
          error.message,
        );
      }
    }

    console.log(
      `✅ Users: ${stats.usersUpdated}/${stats.usersProcessed} updated`,
    );

    // ========================================================================
    // MIGRATE LOCATIONS COLLECTION
    // ========================================================================
    console.log("\n📍 Migrating locations collection...");
    const locationsSnapshot = await adminDb.collection("locations").get();
    console.log(`Found ${locationsSnapshot.size} locations to process`);

    for (const doc of locationsSnapshot.docs) {
      stats.locationsProcessed++;
      const data = doc.data();

      try {
        const hasPartnerId = "partnerId" in data;
        const needsOrgId = !data.organizationId && data.partnerId;

        if (hasPartnerId || needsOrgId) {
          const updates: any = {
            updated_at: new Date(),
          };

          if (needsOrgId) {
            const orgId = await getOrganizationId(data.partnerId);
            if (orgId) {
              updates.organizationId = orgId;
              console.log(
                `  ✅ Mapped partnerId→organizationId for location ${data.address || doc.id}`,
              );
            }
          }

          if (hasPartnerId) {
            await adminDb.collection("locations").doc(doc.id).update({
              ...updates,
              partnerId: FieldValue.delete(),
            });

            stats.locationsUpdated++;
            console.log(
              `  ✓ Removed partnerId from location: ${data.address || doc.id}`,
            );
          } else if (Object.keys(updates).length > 1) {
            await adminDb.collection("locations").doc(doc.id).update(updates);

            stats.locationsUpdated++;
            console.log(
              `  ✓ Updated organizationId for location: ${data.address || doc.id}`,
            );
          }
        }
      } catch (error: any) {
        stats.errors.push({
          collection: "locations",
          id: doc.id,
          error: error.message,
        });
        console.error(
          `  ✗ Error updating location ${doc.id}:`,
          error.message,
        );
      }
    }

    console.log(
      `✅ Locations: ${stats.locationsUpdated}/${stats.locationsProcessed} updated`,
    );

    // ========================================================================
    // UPDATE FIREBASE AUTH CUSTOM CLAIMS
    // ========================================================================
    console.log("\n🔐 Updating Firebase Auth custom claims...");
    const authUsers = await adminAuth.listUsers(1000);
    console.log(`Found ${authUsers.users.length} auth users to process`);

    for (const authUser of authUsers.users) {
      stats.authProcessed++;
      const claims = authUser.customClaims || {};

      try {
        const hasPartnerId = "partnerId" in claims;
        const needsOrgId = !claims.organizationId && claims.partnerId;

        if (hasPartnerId || needsOrgId) {
          const newClaims = { ...claims };

          // Map partnerId to organizationId if needed
          if (needsOrgId) {
            const orgId = await getOrganizationId(claims.partnerId);
            if (orgId) {
              newClaims.organizationId = orgId;
              console.log(
                `  ✅ Mapped partnerId→organizationId for Auth ${authUser.email || authUser.uid}`,
              );
            }
          }

          // Remove partnerId
          if (hasPartnerId) {
            delete newClaims.partnerId;
          }

          await adminAuth.setCustomUserClaims(authUser.uid, newClaims);

          stats.authUpdated++;
          console.log(
            `  ✓ Updated Auth custom claims: ${authUser.email || authUser.uid}`,
          );
        }
      } catch (error: any) {
        stats.errors.push({
          collection: "auth",
          id: authUser.uid,
          email: authUser.email,
          error: error.message,
        });
        console.error(
          `  ✗ Error updating Auth ${authUser.email || authUser.uid}:`,
          error.message,
        );
      }
    }

    console.log(
      `✅ Auth: ${stats.authUpdated}/${stats.authProcessed} updated`,
    );

    // ========================================================================
    // FINAL SUMMARY
    // ========================================================================
    const duration = Date.now() - stats.startTime;

    console.log("\n" + "=".repeat(80));
    console.log("✅ MIGRATION COMPLETE");
    console.log("=".repeat(80));
    console.log(`\n⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`📊 Summary:`);
    console.log(`   Users: ${stats.usersUpdated}/${stats.usersProcessed} updated`);
    console.log(
      `   Locations: ${stats.locationsUpdated}/${stats.locationsProcessed} updated`,
    );
    console.log(
      `   Auth: ${stats.authUpdated}/${stats.authProcessed} updated`,
    );
    console.log(`   Organizations mapped: ${stats.organizationsMapped}`);
    console.log(`   Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log("\n🔴 ERRORS:\n");
      stats.errors.forEach((err, i) => {
        console.log(
          `${i + 1}. ${err.collection}/${err.id}${err.email ? ` (${err.email})` : ""}: ${err.error}`,
        );
      });
    }

    console.log("\n✨ partnerId has been removed from the database!");
    console.log("⚠️  Next steps:");
    console.log("   1. Update codebase to remove partnerId references");
    console.log("   2. Deploy updated code");
    console.log("   3. Test thoroughly");
    console.log("   4. DELETE this migration endpoint for security\n");

    return NextResponse.json({
      success: true,
      message: "Migration completed successfully",
      stats: {
        duration: `${(duration / 1000).toFixed(2)}s`,
        users: {
          processed: stats.usersProcessed,
          updated: stats.usersUpdated,
        },
        locations: {
          processed: stats.locationsProcessed,
          updated: stats.locationsUpdated,
        },
        auth: {
          processed: stats.authProcessed,
          updated: stats.authUpdated,
        },
        organizationsMapped: stats.organizationsMapped,
        errors: stats.errors,
      },
    });
  } catch (error: any) {
    console.error("\n💥 MIGRATION FAILED:", error);
    console.error("Stack trace:", error.stack);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

// GET method - just returns info about the endpoint
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/admin/migrate/remove-partner-id",
    method: "POST",
    description: "One-time migration to remove partnerId from database",
    required_header: "x-migration-key",
    status: "Ready to run",
    warning:
      "This is a destructive operation. Make sure you have a backup!",
  });
}

