import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { getUserClaims, requireRole } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

const COLL = "locationPreferences";

async function authed(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { error: "Unauthorized", status: 401 as const };
  const claims = await getUserClaims(token);
  if (!claims) return { error: "Invalid token", status: 401 as const };
  requireRole(claims, ["org_manager", "admin", "superadmin", "partner_admin"]);
  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  try {
    const a = await authed(request);
    if ("error" in a)
      return NextResponse.json({ error: a.error }, { status: a.status });

    const body = await request.json();
    const { locationId, taskId, customInstruction, createdBy } = body;

    if (!locationId || !taskId || !customInstruction || !createdBy) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: locationId, taskId, customInstruction, createdBy",
        },
        { status: 400 },
      );
    }

    // Upsert keyed by (locationId, taskId) — one preference per task per
    // location. Deterministic id keeps repeated POSTs idempotent.
    const docId = `${locationId}__${taskId}`;
    const ref = adminDb.collection(COLL).doc(docId);
    const now = FieldValue.serverTimestamp();
    await ref.set(
      {
        locationId,
        taskId,
        customInstruction,
        createdBy,
        updatedAt: now,
        createdAt: now,
      },
      { merge: true },
    );

    return NextResponse.json({ success: true, preferenceId: docId });
  } catch (error: any) {
    console.error("Set preference error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to set preference" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const a = await authed(request);
    if ("error" in a)
      return NextResponse.json({ error: a.error }, { status: a.status });

    const body = await request.json();
    const { preferenceId } = body;
    if (!preferenceId) {
      return NextResponse.json(
        { error: "Missing preference ID" },
        { status: 400 },
      );
    }

    await adminDb.collection(COLL).doc(preferenceId).delete();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete preference error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete preference" },
      { status: 500 },
    );
  }
}
