import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getUserClaims, requireRole } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { locationId: string } },
) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const claims = await getUserClaims(token);
    if (!claims)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    requireRole(claims, [
      "org_manager",
      "admin",
      "superadmin",
      "partner_admin",
    ]);

    const snap = await adminDb
      .collection("locationPreferences")
      .where("locationId", "==", params.locationId)
      .get();

    const preferences = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ success: true, preferences });
  } catch (error: any) {
    console.error("Get preferences error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get preferences" },
      { status: 500 },
    );
  }
}
