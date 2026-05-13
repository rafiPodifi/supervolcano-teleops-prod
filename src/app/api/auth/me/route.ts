/**
 * API Route: Get Current User Info
 * Returns current authenticated user's information including role and organization
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserClaims } from "@/lib/utils/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { adminAuth } from "@/lib/firebaseAdmin";
import { authForTenant } from "@/lib/auth/tenantAuth";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const claims = await getUserClaims(token);

    if (!claims) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get uid + tenant from decoded token
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const tenantId = (decodedToken.firebase as { tenant?: string } | undefined)
      ?.tenant;

    // Get user document for additional info
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    // Identity Platform tenant users live in their tenant's user pool;
    // the root Auth.getUser() will return user-not-found for them.
    const firebaseUser = await authForTenant(tenantId).getUser(uid);

    // Get organization name if organizationId exists
    let organizationName: string | undefined;
    if (claims.organizationId) {
      try {
        const orgDoc = await adminDb
          .collection("organizations")
          .doc(claims.organizationId)
          .get();
        if (orgDoc.exists) {
          organizationName = orgDoc.data()?.name;
        }
      } catch (error) {
        console.error("Failed to load organization:", error);
      }
    }

    // Get teleoperator info if teleoperatorId exists
    let displayName: string | undefined;
    if (claims.teleoperatorId) {
      try {
        const teleopDoc = await adminDb
          .collection("teleoperators")
          .doc(claims.teleoperatorId)
          .get();
        if (teleopDoc.exists) {
          displayName = teleopDoc.data()?.displayName;
        }
      } catch (error) {
        console.error("Failed to load teleoperator:", error);
      }
    }

    return NextResponse.json({
      uid: uid,
      email: firebaseUser.email,
      role: claims.role,
      partnerId: claims.partnerId,
      organizationId: claims.organizationId,
      organizationName,
      teleoperatorId: claims.teleoperatorId,
      displayName:
        displayName ||
        userData?.displayName ||
        firebaseUser.displayName ||
        firebaseUser.email?.split("@")[0],
    });
  } catch (error: any) {
    console.error("[api] GET /api/auth/me - Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
