import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { getUserClaims, requireRole } from "@/lib/utils/auth";
import { taskTemplates } from "@/lib/repositories/taxonomyFirestore";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { templateId: string } },
) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const claims = await getUserClaims(token);
    if (!claims)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    requireRole(claims, ["superadmin", "admin"]);

    const templateId = params.templateId;
    const body = await request.json();
    const { location_id, custom_steps, custom_tools } = body;

    if (!location_id) {
      return NextResponse.json(
        { success: false, error: "location_id is required" },
        { status: 400 },
      );
    }

    const template = await taskTemplates.get(templateId);
    if (!template) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 },
      );
    }

    const locationDoc = await adminDb
      .collection("locations")
      .doc(location_id)
      .get();
    const locationName = (locationDoc.data()?.name as string) ?? "";

    const categoryName =
      (template.category_name as string)?.toLowerCase() || "general";

    const taskId = `task-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    await adminDb
      .collection("jobs")
      .doc(taskId)
      .set({
        title: template.name,
        description: (template.description as string) || "",
        category: categoryName,
        priority: (template.priority as string) || "medium",
        locationId: location_id,
        locationName,
        estimatedDurationMinutes:
          (template.estimated_duration_minutes as number) ?? 15,
        status: "available",
        templateId,
        customSteps: custom_steps ?? null,
        customTools: custom_tools ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    // Increment usage counter on template
    await adminDb
      .collection("taskTemplates")
      .doc(templateId)
      .update({
        usage_count: FieldValue.increment(1),
        updated_at: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({
      success: true,
      taskId,
      message: "Task created from template",
    });
  } catch (error: any) {
    console.error("Failed to create task from template:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
