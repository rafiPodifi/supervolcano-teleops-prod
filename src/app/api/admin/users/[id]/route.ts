/**
 * USER MANAGEMENT API - SINGLE USER
 * GET - Get single user details
 * PATCH - Update user details
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { authForTenant } from "@/lib/auth/tenantAuth";
import { requireAdmin } from "@/lib/apiAuth";
import type { User, UserRole } from "@/domain/user/user.types";

/** Pull the Identity Platform tenant off a decoded ID token, if any. */
function tenantFromToken(
  decodedToken: { firebase?: { tenant?: string } } | undefined,
): string | null {
  return decodedToken?.firebase?.tenant ?? null;
}

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

// ============================================================================
// GET - Get single user with full details
// ============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authorized = await requireAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = params;

    // Scope Auth lookups to the caller's Identity Platform tenant. Users live
    // inside a tenant's pool; the root Auth instance returns auth/user-not-found.
    const authHeader = request.headers.get("x-firebase-token");
    const decodedToken = authHeader
      ? await adminAuth.verifyIdToken(authHeader)
      : undefined;
    const tenantAuth = authForTenant(tenantFromToken(decodedToken));

    // Get from Firebase Auth
    const authUser = await tenantAuth.getUser(userId);
    const customClaims = authUser.customClaims || {};

    // Get from Firestore
    const firestoreDoc = await adminDb.collection("users").doc(userId).get();
    const firestoreData = firestoreDoc.exists
      ? (firestoreDoc.data() as Record<string, unknown>)
      : null;

    // Calculate sync status
    const { syncStatus, syncIssues } = calculateSyncStatus(
      customClaims,
      firestoreData,
    );

    const user: User = {
      uid: userId,
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
            organizationId: firestoreData.organizationId as string | undefined,
            teleoperatorId: firestoreData.teleoperatorId as string | undefined,
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

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error: unknown) {
    console.error("Failed to get user:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get user";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

// ============================================================================
// PATCH - Update user details
// ============================================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Get auth token for audit logging
    let decodedToken;
    const authHeader = request.headers.get("x-firebase-token");
    if (authHeader) {
      try {
        decodedToken = await adminAuth.verifyIdToken(authHeader);
      } catch {
        // Token verification failed, but requireAdmin will check it
      }
    }

    const authorized = await requireAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get decoded token if not already available
    if (!decodedToken && authHeader) {
      decodedToken = await adminAuth.verifyIdToken(authHeader);
    }

    // Scope Auth ops to the caller's Identity Platform tenant; the root Auth
    // instance cannot find tenant-pool users (auth/user-not-found -> 500).
    const tenantAuth = authForTenant(tenantFromToken(decodedToken));

    const { id: userId } = params;
    const body = await request.json();

    const {
      displayName,
      role,
      organizationId,
      teleoperatorId,
      disabled,
      syncToAuth,
      syncToFirestore,
    } = body;

    // Validate required fields
    if (!role && syncToAuth) {
      return NextResponse.json(
        { success: false, error: "Role is required" },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {};

    // Update Auth custom claims if requested
    if (syncToAuth) {
      const customClaims: Record<string, unknown> = {};
      if (role !== undefined) customClaims.role = role;
      if (organizationId !== undefined)
        customClaims.organizationId = organizationId;
      if (teleoperatorId !== undefined)
        customClaims.teleoperatorId = teleoperatorId;

      await tenantAuth.setCustomUserClaims(userId, customClaims);
      console.log("Updated Auth custom claims:", customClaims);
    }

    // Update Auth display name if provided
    if (displayName !== undefined) {
      await tenantAuth.updateUser(userId, { displayName });
    }

    // Update disabled status if provided
    if (disabled !== undefined) {
      await tenantAuth.updateUser(userId, { disabled });
    }

    // Update Firestore if requested
    if (syncToFirestore) {
      if (role !== undefined) updates.role = role;
      if (displayName !== undefined) updates.displayName = displayName;
      if (organizationId !== undefined) updates.organizationId = organizationId;
      if (teleoperatorId !== undefined) updates.teleoperatorId = teleoperatorId;
      updates.updated_at = new Date();

      const firestoreDoc = await adminDb.collection("users").doc(userId).get();

      if (firestoreDoc.exists) {
        await adminDb.collection("users").doc(userId).update(updates);
      } else {
        // Create if doesn't exist
        const authUser = await tenantAuth.getUser(userId);
        await adminDb
          .collection("users")
          .doc(userId)
          .set({
            email: authUser.email || "",
            ...updates,
            created_at: new Date(),
          });
      }
      console.log("Updated Firestore document:", updates);
    }

    // Log the change for audit trail
    if (decodedToken) {
      try {
        await adminDb.collection("audit_logs").add({
          entityId: userId,
          entityType: "user",
          action: "user_update",
          actorId: decodedToken.uid || decodedToken.email || "system",
          createdAt: new Date(),
          details: {
            changes: body,
            syncToAuth,
            syncToFirestore,
          },
        });
      } catch (auditError) {
        // Don't fail the request if audit logging fails
        console.error("Failed to log audit entry:", auditError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
    });
  } catch (error: unknown) {
    console.error("Failed to update user:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update user";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

// ============================================================================
// DELETE - Delete user
// ============================================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Get auth token
    const authHeader = request.headers.get("x-firebase-token");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can delete users
    if (decodedToken.role !== "admin" && decodedToken.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: userId } = params;

    // Prevent self-deletion
    if (userId === decodedToken.uid) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 },
      );
    }

    // Delete from Firebase Auth, scoped to the caller's tenant pool.
    const tenantAuth = authForTenant(tenantFromToken(decodedToken));
    await tenantAuth.deleteUser(userId);
    console.log("[DELETE User] Deleted from Auth:", userId);

    // Delete from Firestore
    await adminDb.collection("users").doc(userId).delete();
    console.log("[DELETE User] Deleted from Firestore:", userId);

    // Audit log
    try {
      await adminDb.collection("audit_logs").add({
        entityId: userId,
        entityType: "user",
        action: "user_delete",
        actorId: decodedToken.uid || decodedToken.email || "system",
        createdAt: new Date(),
      });
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      console.error("Failed to log audit entry:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error: unknown) {
    console.error("Failed to delete user:", error);

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "auth/user-not-found"
    ) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const message =
      error instanceof Error ? error.message : "Failed to delete user";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
