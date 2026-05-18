import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { getUserClaims, requireRole } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

async function authed(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { error: "Unauthorized", status: 401 as const };
  const claims = await getUserClaims(token);
  if (!claims) return { error: "Invalid token", status: 401 as const };
  requireRole(claims, ["superadmin", "admin", "partner_admin"]);
  return { token };
}

export async function GET(request: NextRequest) {
  try {
    const a = await authed(request);
    if ("error" in a)
      return NextResponse.json({ error: a.error }, { status: a.status });

    const sp = request.nextUrl.searchParams;
    const locationId = sp.get("locationId") ?? undefined;
    const jobId = sp.get("jobId") ?? undefined;
    const limit = parseInt(sp.get("limit") ?? "50");
    const offset = parseInt(sp.get("offset") ?? "0");

    let q: FirebaseFirestore.Query = adminDb.collection("tasks");
    if (locationId) q = q.where("locationId", "==", locationId);
    if (jobId) q = q.where("jobId", "==", jobId);
    q = q.orderBy("createdAt", "desc");

    const snap = await q.get();
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const tasks = all.slice(offset, offset + limit);

    return NextResponse.json({ success: true, tasks });
  } catch (error: any) {
    console.error("Get tasks error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get tasks" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const a = await authed(request);
    if ("error" in a)
      return NextResponse.json({ error: a.error }, { status: a.status });

    const decoded = await adminAuth.verifyIdToken(a.token);
    const userId = decoded.uid;

    const data = await request.json();
    if (!data.title) {
      return NextResponse.json(
        { success: false, error: "Title is required" },
        { status: 400 },
      );
    }
    if (!data.locationId) {
      return NextResponse.json(
        { success: false, error: "Location ID is required" },
        { status: 400 },
      );
    }

    const taskData = {
      title: data.title,
      description: data.description ?? "",
      category: data.category ?? "general",
      locationId: data.locationId,
      locationName: data.locationName ?? "",
      estimatedDuration: data.estimatedDurationMinutes ?? null,
      priority: data.priority ?? "medium",
      status: "available",
      state: "available",
      assigned_to: "unassigned",
      createdAt: new Date(),
      createdBy: userId || "admin",
      updatedAt: new Date(),
      partnerOrgId: data.partnerOrgId ?? "demo-org",
    };

    const docRef = await adminDb.collection("tasks").add(taskData);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: "Task created",
      task: { id: docRef.id, ...taskData },
    });
  } catch (error: any) {
    console.error("Failed to create task:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create task" },
      { status: 500 },
    );
  }
}
