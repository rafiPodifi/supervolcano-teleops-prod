import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { getUserClaims, requireRole } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { targetId: string } },
) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const claims = await getUserClaims(token);
    if (!claims)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    requireRole(claims, ["superadmin", "admin"]);

    const targetId = params.targetId;
    const body = await request.json();
    const {
      action_type_id,
      custom_instructions,
      custom_duration_minutes,
      sort_order,
    } = body;

    if (!action_type_id) {
      return NextResponse.json(
        { success: false, error: "action_type_id is required" },
        { status: 400 },
      );
    }

    const now = FieldValue.serverTimestamp();
    const ref = adminDb.collection("targetActions").doc();
    await ref.set({
      target_id: targetId,
      action_type_id,
      custom_instructions: custom_instructions ?? null,
      custom_duration_minutes: custom_duration_minutes ?? null,
      sort_order: sort_order ?? 0,
      is_active: true,
      created_at: now,
      updated_at: now,
    });
    const snap = await ref.get();
    return NextResponse.json({
      success: true,
      action: { id: ref.id, ...snap.data() },
    });
  } catch (error: any) {
    console.error("Failed to create action:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
