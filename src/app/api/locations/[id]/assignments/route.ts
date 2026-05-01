/**
 * LOCATION ASSIGNMENTS API
 * Manage which organizations have access to a location
 * Supports multiple organizations per location
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

// GET - List all organizations assigned to a location
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    await adminAuth.verifyIdToken(token);

    const locationDoc = await adminDb
      .collection("locations")
      .doc(params.id)
      .get();

    if (!locationDoc.exists) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }

    const locationData = locationDoc.data();

    // Support new assignedOrganizations array, with fallback to legacy organizationId
    const assignedOrganizations = locationData?.assignedOrganizations || [];
    const legacyOrgId = locationData?.organizationId;
    const orgIds =
      assignedOrganizations.length > 0
        ? assignedOrganizations
        : legacyOrgId
          ? [legacyOrgId]
          : [];

    // Fetch organization details
    const orgDetails = await Promise.all(
      orgIds.map(async (orgId: string) => {
        const orgDoc = await adminDb
          .collection("organizations")
          .doc(orgId)
          .get();
        if (!orgDoc.exists) return null;
        const orgData = orgDoc.data();
        return {
          id: orgDoc.id,
          name: orgData?.name,
          type: orgData?.type,
          slug: orgData?.slug,
          ...orgData,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      locationId: params.id,
      assignments: orgDetails.filter(Boolean),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Add organization assignment to location
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Only admins can modify assignments
    if (decodedToken.role !== "admin" && decodedToken.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId required" },
        { status: 400 },
      );
    }

    // Verify organization exists
    const orgDoc = await adminDb
      .collection("organizations")
      .doc(organizationId)
      .get();
    if (!orgDoc.exists) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    // Get location
    const locationDoc = await adminDb
      .collection("locations")
      .doc(params.id)
      .get();
    if (!locationDoc.exists) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }

    const locationData = locationDoc.data();
    const currentAssignments = locationData?.assignedOrganizations || [];
    const legacyOrgId = locationData?.organizationId;

    // Initialize assignedOrganizations array if it doesn't exist
    const updatedAssignments = [...currentAssignments];

    // If legacy organizationId exists and isn't in array, add it
    if (legacyOrgId && !updatedAssignments.includes(legacyOrgId)) {
      updatedAssignments.push(legacyOrgId);
    }

    // Add if not already assigned
    if (!updatedAssignments.includes(organizationId)) {
      updatedAssignments.push(organizationId);

      await adminDb.collection("locations").doc(params.id).update({
        assignedOrganizations: updatedAssignments,
        updated_at: new Date(),
      });

      // Audit log
      await adminDb.collection("audit_logs").add({
        action: "location_assignment_added",
        performedBy: decodedToken.uid,
        locationId: params.id,
        organizationId,
        timestamp: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      message: "Organization assigned to location",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Remove organization assignment from location
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (decodedToken.role !== "admin" && decodedToken.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId required" },
        { status: 400 },
      );
    }

    const locationDoc = await adminDb
      .collection("locations")
      .doc(params.id)
      .get();
    if (!locationDoc.exists) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }

    const locationData = locationDoc.data();
    const currentAssignments = locationData?.assignedOrganizations || [];
    const updatedAssignments = currentAssignments.filter(
      (id: string) => id !== organizationId,
    );

    await adminDb.collection("locations").doc(params.id).update({
      assignedOrganizations: updatedAssignments,
      updated_at: new Date(),
    });

    // Audit log
    await adminDb.collection("audit_logs").add({
      action: "location_assignment_removed",
      performedBy: decodedToken.uid,
      locationId: params.id,
      organizationId,
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "Organization assignment removed",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
