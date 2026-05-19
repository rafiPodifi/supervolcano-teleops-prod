/**
 * MOBILE API — TASKS FOR A LOCATION
 * GET: list tasks for a location, for the signed-in field worker.
 *
 * The mobile app cannot read the top-level `tasks` collection directly:
 * the Firestore client-SDK rule keys reads on `partnerOrgId`, and a query
 * filtered only by `locationId` is rejected wholesale (rules are not
 * filters). This route runs the query with the Admin SDK (bypasses rules)
 * after verifying the caller is actually assigned to the location.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const locationId = params.id;

    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const role = (decoded as { role?: string }).role;
    const isAdmin = role === "admin" || role === "superadmin";

    // Non-admins may only see tasks for a location they are assigned to.
    if (!isAdmin) {
      const assignment = await adminDb
        .collection("assignments")
        .where("user_id", "==", decoded.uid)
        .where("status", "==", "active")
        .get();

      const assignedLocationIds = new Set(
        assignment.docs
          .map((d) => {
            const data = d.data();
            return data.location_id || data.locationId;
          })
          .filter(Boolean),
      );

      if (!assignedLocationIds.has(locationId)) {
        return NextResponse.json(
          { error: "You are not assigned to this location" },
          { status: 403 },
        );
      }
    }

    // Query top-level `tasks`, falling back to the legacy `propertyId`
    // field during the locationId migration.
    let snap = await adminDb
      .collection("tasks")
      .where("locationId", "==", locationId)
      .get();

    if (snap.empty) {
      snap = await adminDb
        .collection("tasks")
        .where("propertyId", "==", locationId)
        .get();
    }

    const jobs = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title || data.name,
        description: data.description,
        category: data.category,
        priority: data.priority,
        locationId: data.locationId || data.propertyId,
        locationName: data.locationName,
      };
    });

    return NextResponse.json({ success: true, jobs });
  } catch (error: unknown) {
    console.error("[mobile] GET location tasks failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch tasks";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
