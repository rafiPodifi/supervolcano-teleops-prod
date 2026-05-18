/**
 * CREATE USER API
 * Properly creates users with clean schema from the start
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { authForTenant } from "@/lib/auth/tenantAuth";
import { requireAdmin } from "@/lib/apiAuth";
import type { UserRole } from "@/domain/user/user.types";

interface CreateUserRequest {
  email: string;
  password: string;
  displayName?: string;
  role: UserRole;
  organizationId?: string;
  teleoperatorId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authorized = await requireAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Get decoded token if not already available
    if (!decodedToken && authHeader) {
      decodedToken = await adminAuth.verifyIdToken(authHeader);
    }

    const body: CreateUserRequest = await request.json();

    // Validate required fields
    if (!body.email || !body.password || !body.role) {
      return NextResponse.json(
        { success: false, error: "Email, password, and role are required" },
        { status: 400 },
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 },
      );
    }

    // Validate password strength
    if (body.password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    // Validate role-specific requirements
    if (
      (body.role === "partner_manager" ||
        body.role === "oem_teleoperator" ||
        body.role === "location_owner" ||
        body.role === "location_cleaner") &&
      !body.organizationId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "organizationId is required for this role",
        },
        { status: 400 },
      );
    }

    // Scope all Auth ops to the caller's Identity Platform tenant. Without
    // this the user lands in the project-level pool and clients that sign in
    // against the tenant (e.g. mobile) hit auth/user-not-found.
    const tenantId =
      (decodedToken?.firebase as { tenant?: string } | undefined)?.tenant ??
      null;
    const tenantAuth = authForTenant(tenantId);
    console.log("[CREATE User] Creating in tenant:", tenantId ?? "<default>");

    // Create Auth user
    const userRecord = await tenantAuth.createUser({
      email: body.email,
      password: body.password,
      displayName: body.displayName,
    });

    console.log("[CREATE User] Auth user created:", userRecord.uid);

    // Set custom claims
    const customClaims: Record<string, unknown> = {
      role: body.role,
    };

    if (body.organizationId) {
      customClaims.organizationId = body.organizationId;
      // permissions middleware reads partnerId for non-superadmin roles
      customClaims.partnerId = body.organizationId;
    }

    if (body.teleoperatorId) {
      customClaims.teleoperatorId = body.teleoperatorId;
    }

    await tenantAuth.setCustomUserClaims(userRecord.uid, customClaims);
    console.log("[CREATE User] Custom claims set:", customClaims);

    // Create Firestore document
    const firestoreData: Record<string, unknown> = {
      email: body.email,
      displayName: body.displayName,
      role: body.role,
      created_at: new Date(),
      updated_at: new Date(),
    };

    if (body.organizationId) {
      firestoreData.organizationId = body.organizationId;
    }

    if (body.teleoperatorId) {
      firestoreData.teleoperatorId = body.teleoperatorId;
    }

    await adminDb.collection("users").doc(userRecord.uid).set(firestoreData);
    console.log("[CREATE User] Firestore document created");

    // Audit log
    if (decodedToken) {
      try {
        await adminDb.collection("audit_logs").add({
          entityId: userRecord.uid,
          entityType: "user",
          action: "user_create",
          actorId: decodedToken.uid || decodedToken.email || "system",
          createdAt: new Date(),
          details: {
            email: body.email,
            role: body.role,
            organizationId: body.organizationId,
          },
        });
      } catch (auditError) {
        // Don't fail the request if audit logging fails
        console.error("Failed to log audit entry:", auditError);
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        uid: userRecord.uid,
        email: body.email,
        displayName: body.displayName,
        role: body.role,
      },
    });
  } catch (error: unknown) {
    console.error("Failed to create user:", error);

    // Handle specific Firebase Auth errors
    if (error instanceof Error && "code" in error) {
      const firebaseError = error as any;
      if (firebaseError.code === "auth/email-already-exists") {
        return NextResponse.json(
          { success: false, error: "Email already exists" },
          { status: 400 },
        );
      }

      if (firebaseError.code === "auth/invalid-password") {
        return NextResponse.json(
          { success: false, error: "Password is too weak" },
          { status: 400 },
        );
      }
    }

    const message =
      error instanceof Error ? error.message : "Failed to create user";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
