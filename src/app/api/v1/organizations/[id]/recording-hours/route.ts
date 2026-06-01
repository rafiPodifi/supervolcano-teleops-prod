/**
 * API Route: Organization Recording Hours
 * GET: Per-cleaner recording hours scoped to a single organization.
 * Optional query params: ?from=ISO&to=ISO&locationId=...
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserClaims, requireRole } from "@/lib/utils/auth";
import {
  aggregateRecordingHours,
  buildRecordingFilterFromParams,
} from "@/lib/repositories/recordingStats";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const organizationId = params.id;
    const token = request.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const claims = await getUserClaims(token);
    if (!claims) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    requireRole(claims, [
      "superadmin",
      "admin",
      "partner_admin",
      "partner_manager",
      "org_manager",
      "location_owner",
    ]);

    // Non-admins can only read their own organization.
    if (
      claims.role !== "superadmin" &&
      claims.role !== "admin" &&
      claims.organizationId !== organizationId
    ) {
      return NextResponse.json(
        { error: "Access denied to this organization" },
        { status: 403 },
      );
    }

    const filter = buildRecordingFilterFromParams(
      new URL(request.url).searchParams,
      { organizationId },
    );
    const cleaners = await aggregateRecordingHours(filter);

    return NextResponse.json({
      success: true,
      cleaners,
      count: cleaners.length,
    });
  } catch (error: any) {
    console.error(
      "[api] GET /api/v1/organizations/[id]/recording-hours - Error:",
      error,
    );
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to load recording hours",
      },
      { status: error.statusCode || 500 },
    );
  }
}
