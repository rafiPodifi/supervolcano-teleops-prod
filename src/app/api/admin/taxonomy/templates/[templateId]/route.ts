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

export async function GET(
  request: NextRequest,
  { params }: { params: { templateId: string } },
) {
  try {
    const a = await authed(request);
    if ("error" in a)
      return NextResponse.json({ error: a.error }, { status: a.status });

    const template = await taskTemplates.get(params.templateId);
    if (!template) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    console.error("Failed to fetch template:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { templateId: string } },
) {
  try {
    const a = await authed(request);
    if ("error" in a)
      return NextResponse.json({ error: a.error }, { status: a.status });

    const body = await request.json();
    const template = await taskTemplates.patch(params.templateId, {
      category_id: body.category_id,
      name: body.name,
      description: body.description,
      steps: body.steps,
      tools_required: body.tools_required,
      safety_notes: body.safety_notes,
      instruction_video_url: body.instruction_video_url,
      instruction_images: body.instruction_images,
      estimated_duration_minutes: body.estimated_duration_minutes,
      difficulty_level: body.difficulty_level,
      priority: body.priority,
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    console.error("Failed to update template:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { templateId: string } },
) {
  try {
    const a = await authed(request);
    if ("error" in a)
      return NextResponse.json({ error: a.error }, { status: a.status });

    const ok = await taskTemplates.softDelete(params.templateId);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: "Template deleted" });
  } catch (error: any) {
    console.error("Failed to delete template:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
