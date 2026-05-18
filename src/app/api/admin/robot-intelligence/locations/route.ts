import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getUserClaims, requireRole } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const claims = await getUserClaims(token);
    if (!claims)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    requireRole(claims, ["superadmin", "admin", "partner_admin"]);

    const snap = await adminDb.collection("locations").orderBy("name").get();
    const locations = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name || d.organizationName || "Unnamed Location",
        organizationId: d.organizationId ?? d.organization_id ?? null,
        organizationName: d.organizationName ?? d.organization_name ?? null,
      };
    });

    return NextResponse.json({ success: true, locations });
  } catch (error: any) {
    console.error("[Robot Intelligence] Get locations error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to get locations",
        locations: [],
      },
      { status: 500 },
    );
  }
}
