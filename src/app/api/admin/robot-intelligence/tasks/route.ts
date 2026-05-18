import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getUserClaims, requireRole } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const claims = await getUserClaims(token);
    if (!claims)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    requireRole(claims, ["superadmin", "admin", "partner_admin"]);

    const locationId = request.nextUrl.searchParams.get("locationId");
    let q: FirebaseFirestore.Query = adminDb.collection("jobs");
    if (locationId) q = q.where("locationId", "==", locationId);
    q = q.orderBy("title", "asc");

    const snap = await q.get();
    const tasks = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title ?? null,
        location_id: d.locationId ?? d.location_id ?? null,
        category: d.category ?? null,
      };
    });

    return NextResponse.json({ success: true, tasks });
  } catch (error: any) {
    console.error("Get tasks error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get tasks" },
      { status: 500 },
    );
  }
}
