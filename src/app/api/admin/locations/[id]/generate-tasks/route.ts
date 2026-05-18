import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getUserClaims, requireRole } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

// Reads location structure from flat top-level Firestore collections
// (locationRooms, locationTargets, targetActions) — written by the
// ad-hoc POST endpoints under /api/admin/{locations,rooms,targets}/...
// Joins with taxonomy lookups (libraryRoomTypes etc.) on read.

type Row = { id: string } & Record<string, unknown>;

async function fetchTaxonomyMap(collection: string): Promise<Map<string, Row>> {
  const snap = await adminDb.collection(collection).get();
  const out = new Map<string, Row>();
  for (const d of snap.docs) out.set(d.id, { id: d.id, ...d.data() });
  return out;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const claims = await getUserClaims(token);
    if (!claims)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    requireRole(claims, ["superadmin", "admin"]);

    const locationId = params.id;

    const [roomsSnap, floorsSnap, locationDoc] = await Promise.all([
      adminDb
        .collection("locationRooms")
        .where("location_id", "==", locationId)
        .get(),
      adminDb
        .collection("locationFloors")
        .where("location_id", "==", locationId)
        .get(),
      adminDb.collection("locations").doc(locationId).get(),
    ]);

    if (roomsSnap.empty) {
      return NextResponse.json(
        { success: false, error: "No rooms found in location structure" },
        { status: 400 },
      );
    }

    const rooms = roomsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const floors = new Map<string, Row>();
    for (const f of floorsSnap.docs)
      floors.set(f.id, { id: f.id, ...f.data() });

    const roomIds = rooms.map((r) => r.id);
    const targetsSnap = await adminDb
      .collection("locationTargets")
      .where("room_id", "in", roomIds.slice(0, 30)) // Firestore `in` cap = 30
      .get();
    // Fallback for >30 rooms: collection group scan would be needed.
    const targets = targetsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (targets.length === 0) {
      return NextResponse.json(
        { success: false, error: "No targets found in location structure" },
        { status: 400 },
      );
    }

    const targetIds = targets.map((t) => t.id);
    const actionsSnap = await adminDb
      .collection("targetActions")
      .where("target_id", "in", targetIds.slice(0, 30))
      .get();
    const actions = actionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (actions.length === 0) {
      return NextResponse.json(
        { success: false, error: "No actions found in location structure" },
        { status: 400 },
      );
    }

    const [roomTypes, targetTypes, actionTypes] = await Promise.all([
      fetchTaxonomyMap("libraryRoomTypes"),
      fetchTaxonomyMap("libraryTargetTypes"),
      fetchTaxonomyMap("libraryActionTypes"),
    ]);

    const locationName = (locationDoc.data()?.name as string) ?? "";
    const tasksCreated: Array<Record<string, unknown>> = [];

    for (const action of actions) {
      const target = targets.find((t) => t.id === (action as any).target_id);
      if (!target) continue;

      const room = rooms.find((r) => r.id === (target as any).room_id);
      if (!room) continue;

      const roomTypeName =
        (roomTypes.get((room as any).room_type_id)?.name as string) ?? "";
      const targetTypeName =
        (targetTypes.get((target as any).target_type_id)?.name as string) ?? "";
      const actionType = actionTypes.get((action as any).action_type_id);
      const actionTypeName = (actionType?.name as string) ?? "";

      const roomName = ((room as any).custom_name as string) || roomTypeName;
      const targetName =
        ((target as any).custom_name as string) || targetTypeName;
      const actionName = actionTypeName;
      const title = `${actionName} ${roomName} ${targetName}`.trim();
      const description =
        ((action as any).custom_instructions as string) ||
        ((actionType?.instructions as string) ?? "");
      const duration =
        ((action as any).custom_duration_minutes as number) ||
        ((actionType?.estimated_duration_minutes as number) ?? 5);

      const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      await adminDb
        .collection("jobs")
        .doc(taskId)
        .set({
          title,
          description,
          category: "general",
          priority: "medium",
          locationId,
          locationName,
          estimatedDurationMinutes: duration,
          status: "available",
          roomId: (room as any).id,
          targetId: (target as any).id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      tasksCreated.push({
        id: taskId,
        title,
        room: roomName,
        target: targetName,
        action: actionName,
      });
    }

    return NextResponse.json({
      success: true,
      tasksCreated: tasksCreated.length,
      tasks: tasksCreated,
    });
  } catch (error: any) {
    console.error("Failed to generate tasks:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
