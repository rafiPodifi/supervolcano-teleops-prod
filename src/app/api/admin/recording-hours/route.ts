import { NextRequest, NextResponse } from "next/server";
import { getUserClaims } from "@/lib/utils/auth";
import {
  aggregateRecordingHours,
  buildRecordingFilterFromParams,
} from "@/lib/repositories/recordingStats";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/recording-hours
 *
 * Recording hours for every cleaner, across all orgs (admin/superadmin only).
 * Optional query params: ?from=ISO&to=ISO&locationId=...
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const claims = await getUserClaims(token);
    if (!claims) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    if (claims.role !== "admin" && claims.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const filter = buildRecordingFilterFromParams(
      new URL(request.url).searchParams,
    );
    const cleaners = await aggregateRecordingHours(filter);

    return NextResponse.json({
      success: true,
      cleaners,
      count: cleaners.length,
    });
  } catch (error: any) {
    console.error("Failed to aggregate recording hours:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
