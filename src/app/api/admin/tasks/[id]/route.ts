import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getUserClaims, requireRole } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

async function authed(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { error: "Unauthorized", status: 401 as const };
  const claims = await getUserClaims(token);
  if (!claims) return { error: "Invalid token", status: 401 as const };
  requireRole(claims, ["superadmin", "admin", "partner_admin"]);
  return { ok: true as const };
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const a = await authed(request);
    if ("error" in a)
      return NextResponse.json({ error: a.error }, { status: a.status });

    const taskId = params.id;
    const taskRef = adminDb.collection("tasks").doc(taskId);
    const taskDoc = await taskRef.get();
    const taskExisted = taskDoc.exists;

    if (taskExisted) await taskRef.delete();

    const mediaSnap = await adminDb
      .collection("media")
      .where("taskId", "==", taskId)
      .get();
    await Promise.all(mediaSnap.docs.map((d) => d.ref.delete()));

    return NextResponse.json({
      success: true,
      message: "Task deleted",
      taskId,
      deleted: { task: taskExisted, media: mediaSnap.size },
    });
  } catch (error: any) {
    console.error("Failed to delete task:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete task" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const a = await authed(request);
    if ("error" in a)
      return NextResponse.json({ error: a.error }, { status: a.status });

    const updates = await request.json();
    await adminDb
      .collection("tasks")
      .doc(params.id)
      .update({
        ...updates,
        updatedAt: new Date(),
      });

    return NextResponse.json({ success: true, message: "Task updated" });
  } catch (error: any) {
    console.error("Failed to update task:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update task" },
      { status: 500 },
    );
  }
}
