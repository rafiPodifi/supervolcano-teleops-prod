/**
 * USER MANAGEMENT API - LIST USERS
 * GET - Get all users with sync status
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { authForTenant } from "@/lib/auth/tenantAuth";
import { requireAdmin } from "@/lib/apiAuth";
import type { User, UserRole } from "@/domain/user/user.types";

function calculateSyncStatus(
  authClaims: Record<string, unknown>,
  firestoreData: Record<string, unknown> | null,
): {
  syncStatus: User["syncStatus"];
  syncIssues: string[];
} {
  if (!firestoreData) {
    return {
      syncStatus: "auth_only",
      syncIssues: ["User exists in Auth but not in Firestore"],
    };
  }

  const issues: string[] = [];

  const authRole = authClaims.role as UserRole | undefined;
  const firestoreRole = firestoreData.role as UserRole | undefined;
  if (authRole !== firestoreRole) {
    issues.push(
      `Role mismatch: Auth="${authRole || "none"}", Firestore="${firestoreRole || "none"}"`,
    );
  }

  const authOrgId = authClaims.organizationId as string | undefined;
  const firestoreOrgId = firestoreData.organizationId as string | undefined;
  if (authOrgId !== firestoreOrgId) {
    issues.push(
      `Organization mismatch: Auth="${authOrgId || "none"}", Firestore="${firestoreOrgId || "none"}"`,
    );
  }

  if (issues.length === 0) {
    return { syncStatus: "synced", syncIssues: [] };
  }

  return {
    syncStatus: "mismatched",
    syncIssues: issues,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authorized = await requireAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query params for filtering
    const searchParams = request.nextUrl.searchParams;
    const roleFilter = searchParams.get("role") as UserRole | null;
    const syncStatusFilter = searchParams.get("syncStatus") as
      | User["syncStatus"]
      | null;
    const organizationIdFilter = searchParams.get("organizationId");

    // Scope to caller's Identity Platform tenant. adminAuth.listUsers without
    // a tenant returns the project-level pool, which is empty in multi-tenant
    // setups — all users actually live inside the tenant.
    let tenantId: string | null = null;
    const authHeader = request.headers.get("x-firebase-token");
    if (authHeader) {
      try {
        const decoded = await adminAuth.verifyIdToken(authHeader);
        tenantId =
          (decoded.firebase as { tenant?: string } | undefined)?.tenant ?? null;
      } catch {
        // requireAdmin already validated the token; fall back to default pool.
      }
    }
    const tenantAuth = authForTenant(tenantId);
    console.log("[LIST Users] Listing from tenant:", tenantId ?? "<default>");

    // List all users from Firebase Auth
    const listUsersResult = await tenantAuth.listUsers(1000); // Get up to 1000 users
    const users: User[] = [];

    // Process users in batches to check Firestore
    for (const authUser of listUsersResult.users) {
      const customClaims = authUser.customClaims || {};

      // Get Firestore data (we'll use it for filtering)
      const firestoreDoc = await adminDb
        .collection("users")
        .doc(authUser.uid)
        .get();
      const firestoreData = firestoreDoc.exists
        ? (firestoreDoc.data() as Record<string, unknown>)
        : null;

      // Apply role filter - check both auth and firestore
      if (roleFilter) {
        const hasRole =
          customClaims.role === roleFilter ||
          firestoreData?.role === roleFilter;
        if (!hasRole) {
          continue;
        }
      }

      // Apply organization filter - check both auth and firestore
      if (organizationIdFilter) {
        const hasOrg =
          customClaims.organizationId === organizationIdFilter ||
          firestoreData?.organizationId === organizationIdFilter;
        if (!hasOrg) {
          continue;
        }
      }

      // Calculate sync status
      const { syncStatus, syncIssues } = calculateSyncStatus(
        customClaims,
        firestoreData,
      );

      // Apply sync status filter
      if (syncStatusFilter && syncStatus !== syncStatusFilter) {
        continue;
      }

      const user: User = {
        uid: authUser.uid,
        email: authUser.email || "",
        displayName: authUser.displayName || undefined,
        disabled: authUser.disabled || false,
        lastSignInTime: authUser.metadata.lastSignInTime,
        createdAt: authUser.metadata.creationTime,
        auth: {
          role: customClaims.role as UserRole | undefined,
          organizationId: customClaims.organizationId as string | undefined,
          teleoperatorId: customClaims.teleoperatorId as string | undefined,
        },
        firestore: firestoreData
          ? {
              email: (firestoreData.email as string) || authUser.email || "",
              displayName: firestoreData.displayName as string | undefined,
              role: firestoreData.role as UserRole | undefined,
              organizationId: firestoreData.organizationId as
                | string
                | undefined,
              teleoperatorId: firestoreData.teleoperatorId as
                | string
                | undefined,
              created_at: firestoreData.created_at as
                | Date
                | { _seconds: number }
                | string
                | undefined,
              updated_at: firestoreData.updated_at as
                | Date
                | { _seconds: number }
                | string
                | undefined,
            }
          : null,
        syncStatus,
        syncIssues,
      };

      users.push(user);
    }

    // Sort by email
    users.sort((a, b) => a.email.localeCompare(b.email));

    return NextResponse.json({
      success: true,
      users,
      count: users.length,
    });
  } catch (error: unknown) {
    console.error("Failed to list users:", error);
    const message =
      error instanceof Error ? error.message : "Failed to list users";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
