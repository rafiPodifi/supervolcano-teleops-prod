/**
 * GET /api/mobile/recording-hours
 *
 * The signed-in cleaner's own recording hours. Follows the mobile-read
 * convention: verify the bearer token, derive uid, then aggregate with the
 * Admin SDK (bypassing client security rules).
 * Optional query params: ?from=ISO&to=ISO&locationId=...
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import {
  aggregateRecordingHours,
  buildRecordingFilterFromParams,
  type CleanerRecordingHours,
} from "@/lib/repositories/recordingStats";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const filter = buildRecordingFilterFromParams(
      new URL(request.url).searchParams,
      { userId: uid },
    );
    const rows = await aggregateRecordingHours(filter);

    // Self-scoped query returns at most one row; default to zeros otherwise.
    const stats: CleanerRecordingHours = rows[0] ?? {
      userId: uid,
      displayName: uid,
      email: null,
      organizationId: null,
      totalSeconds: 0,
      totalHours: 0,
      videoCount: 0,
      lastRecordedAt: null,
    };

    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    console.error("Failed to load own recording hours:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
