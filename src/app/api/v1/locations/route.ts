/**
 * API Route: Locations
 * GET: List locations
 * POST: Create location
 */

import { NextRequest, NextResponse } from "next/server";
import { createLocation, listLocations } from "@/lib/repositories/locations";
import { getUserClaims, requireRole } from "@/lib/utils/auth";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import type { LocationStatus, LocationType } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    console.log("[api] GET /api/v1/locations - Starting request");

    // Get auth token from header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[api] GET /api/v1/locations - No authorization header");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    console.log(
      "[api] GET /api/v1/locations - Token received, length:",
      token.length,
    );

    const claims = await getUserClaims(token);
    if (!claims) {
      console.error("[api] GET /api/v1/locations - Invalid token");
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    console.log("[api] GET /api/v1/locations - Claims:", {
      role: claims.role,
      partnerId: claims.partnerId,
    });

    // Check permissions
    requireRole(claims, ["partner_admin", "org_manager", "oem_teleoperator"]); // partner_admin, org_manager, teleoperator, or superadmin can list

    // Get query params
    const { searchParams } = new URL(request.url);
    const partnerOrgId = searchParams.get("partnerOrgId") || undefined;
    const status = searchParams.get("status") as LocationStatus | null;

    // Filter by partner if not superadmin
    const finalPartnerId =
      claims.role === "superadmin" ? partnerOrgId : claims.partnerId;

    console.log("[api] GET /api/v1/locations - Querying Firestore:", {
      collection: "locations",
      partnerId: finalPartnerId,
      status: status || undefined,
    });

    const locations = await listLocations(finalPartnerId, status || undefined);

    // Add task counts to each location
    const locationsWithTaskCounts = await Promise.all(
      locations.map(async (location) => {
        try {
          const tasksSnapshot = await adminDb
            .collection("locations")
            .doc(location.locationId)
            .collection("tasks")
            .where("status", "==", "active")
            .get();
          return {
            ...location,
            taskCount: tasksSnapshot.size,
          };
        } catch (error) {
          console.error(
            `Failed to get task count for location ${location.locationId}:`,
            error,
          );
          return {
            ...location,
            taskCount: 0,
          };
        }
      }),
    );

    console.log("[api] GET /api/v1/locations - Success:", {
      count: locationsWithTaskCounts.length,
    });
    return NextResponse.json({ locations: locationsWithTaskCounts });
  } catch (error: any) {
    console.error("[api] GET /api/v1/locations - Error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("[api] POST /api/v1/locations - Starting request");

    // Get auth token from header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[api] POST /api/v1/locations - No authorization header");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    console.log(
      "[api] POST /api/v1/locations - Token received, length:",
      token.length,
    );

    const claims = await getUserClaims(token);
    if (!claims) {
      console.error("[api] POST /api/v1/locations - Invalid token");
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    console.log("[api] POST /api/v1/locations - Claims:", {
      role: claims.role,
      partnerId: claims.partnerId,
    });

    // Check permissions
    requireRole(claims, "partner_admin"); // partner_admin or superadmin can create

    const body = await request.json();
    const {
      name,
      address,
      type,
      primaryContact,
      partnerOrgId,
      accessInstructions,
      entryCode,
      parkingInfo,
      status,
      assignedTeleoperatorIds,
      assignedOrganizationId,
      assignedOrganizationName,
      coordinates,
    } = body;

    console.log("[api] POST /api/v1/locations - Request body:", {
      name,
      address,
      type,
      partnerOrgId,
      hasPrimaryContact: !!primaryContact,
      status,
    });

    // Validate required fields
    if (!name || !address || !partnerOrgId) {
      console.error("[api] POST /api/v1/locations - Missing required fields");
      return NextResponse.json(
        { error: "Missing required fields: name, address, partnerOrgId" },
        { status: 400 },
      );
    }

    // If not superadmin, can only create for their own partner
    if (claims.role !== "superadmin" && partnerOrgId !== claims.partnerId) {
      console.error(
        "[api] POST /api/v1/locations - Permission denied: cannot create for other partners",
      );
      return NextResponse.json(
        { error: "Cannot create location for other partners" },
        { status: 403 },
      );
    }

    // Get user UID from token
    const decodedToken = await adminAuth.verifyIdToken(token);
    const createdBy = decodedToken.uid;

    console.log(
      "[api] POST /api/v1/locations - Creating location in Firestore:",
      {
        collection: "locations",
        name,
        partnerOrgId,
        createdBy,
      },
    );

    const locationId = await createLocation(
      {
        name,
        address,
        type: (type as LocationType) || "other",
        primaryContact: primaryContact || undefined,
        partnerOrgId,
        assignedOrganizationId: assignedOrganizationId || undefined,
        assignedOrganizationName: assignedOrganizationName || undefined,
        accessInstructions: accessInstructions || undefined,
        entryCode: entryCode || undefined,
        parkingInfo: parkingInfo || undefined,
        status: (status as LocationStatus) || "active",
        coordinates: coordinates || undefined,
      },
      createdBy,
    );

    console.log("[api] POST /api/v1/locations - Success:", { locationId });
    return NextResponse.json({ locationId }, { status: 201 });
  } catch (error: any) {
    console.error("[api] POST /api/v1/locations - Error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
      errorType: error.constructor.name,
    });
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
