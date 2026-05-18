import { NextRequest, NextResponse } from "next/server";
import { getUserClaims, requireRole } from "@/lib/utils/auth";
import { roomTypes } from "@/lib/repositories/taxonomyFirestore";

export const dynamic = "force-dynamic";

async function authed(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { error: "Unauthorized", status: 401 as const };
  const claims = await getUserClaims(token);
  if (!claims) return { error: "Invalid token", status: 401 as const };
  requireRole(claims, ["superadmin", "admin"]);
  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  try {
    const a = await authed(request);
    if ("error" in a)
      return NextResponse.json({ error: a.error }, { status: a.status });

    const rows = await roomTypes.list();
    return NextResponse.json({
      success: true,
      roomTypes: rows,
      count: rows.length,
    });
  } catch (error: any) {
    console.error("Failed to fetch room types:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const a = await authed(request);
    if ("error" in a)
      return NextResponse.json({ error: a.error }, { status: a.status });

    const body = await request.json();
    if (!body?.name) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 },
      );
    }

    const roomType = await roomTypes.create({
      name: body.name,
      description: body.description ?? null,
      icon: body.icon ?? null,
      color: body.color,
      default_targets: body.default_targets,
    });

    return NextResponse.json({ success: true, roomType });
  } catch (error: any) {
    console.error("Failed to create room type:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
