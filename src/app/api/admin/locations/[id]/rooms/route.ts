import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { getUserClaims, requireRole } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

// Writes to flat top-level Firestore collection `locationRooms`.
// /api/admin/locations/[id]/structure POST uses nested subcollections
// under /locations/{id}/floors/{floorId}/rooms/... — these two paths
// represent parallel storage today. Consolidation planned in follow-up.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const claims = await getUserClaims(token);
    if (!claims)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    requireRole(claims, ["superadmin", "admin"]);

    const locationId = params.id;
    if (!locationId || locationId.includes("undefined")) {
      return NextResponse.json(
        { success: false, error: "Invalid location ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { floor_id, room_type_id, custom_name, notes, sort_order } = body;

    if (!room_type_id) {
      return NextResponse.json(
        { success: false, error: "room_type_id is required" },
        { status: 400 },
      );
    }

    const now = FieldValue.serverTimestamp();
    const ref = adminDb.collection("locationRooms").doc();
    await ref.set({
      location_id: locationId,
      floor_id: floor_id ?? null,
      room_type_id,
      custom_name: custom_name ?? null,
      notes: notes ?? null,
      sort_order: sort_order ?? 0,
      is_active: true,
      created_at: now,
      updated_at: now,
    });
    const snap = await ref.get();
    return NextResponse.json({
      success: true,
      room: { id: ref.id, ...snap.data() },
    });
  } catch (error: any) {
    console.error("Failed to create room:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
