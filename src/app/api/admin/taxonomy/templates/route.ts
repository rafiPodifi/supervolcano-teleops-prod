import { NextRequest, NextResponse } from "next/server";
import { getUserClaims, requireRole } from "@/lib/utils/auth";
import { taskTemplates } from "@/lib/repositories/taxonomyFirestore";

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

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const templates = await taskTemplates.list(categoryId);

    return NextResponse.json({
      success: true,
      templates,
      count: templates.length,
    });
  } catch (error: any) {
    console.error("Failed to fetch templates:", error);
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
    if (body.steps && !Array.isArray(body.steps)) {
      return NextResponse.json(
        { success: false, error: "Steps must be an array" },
        { status: 400 },
      );
    }

    const template = await taskTemplates.create({
      category_id: body.category_id ?? null,
      name: body.name,
      description: body.description ?? null,
      steps: body.steps ?? null,
      tools_required: body.tools_required ?? null,
      safety_notes: body.safety_notes ?? null,
      instruction_video_url: body.instruction_video_url ?? null,
      instruction_images: body.instruction_images ?? null,
      estimated_duration_minutes: body.estimated_duration_minutes,
      difficulty_level: body.difficulty_level,
      priority: body.priority,
    });

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    console.error("Failed to create template:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
