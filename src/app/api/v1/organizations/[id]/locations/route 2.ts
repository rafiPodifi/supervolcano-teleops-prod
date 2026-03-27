import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getUserClaims, requireRole } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const claims = await getUserClaims(token);
    if (!claims) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    requireRole(claims, ["superadmin", "admin"]);

    const db = getAdminDb();
    const organizationId = params.id;

    // Get locations assigned to this organization
    const locationsSnapshot = await db
      .collection("locations")
      .where("assignedOrganizationId", "==", organizationId)
      .get();

    const locations = await Promise.all(
      locationsSnapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Count rooms by type
        const roomsSnapshot = await db.collection("locations").doc(doc.id).collection("rooms").get();

        const roomCounts = {
          bedroom: 0,
          bathroom: 0,
          kitchen: 0,
          livingArea: 0,
          other: 0,
        };

        roomsSnapshot.docs.forEach((roomDoc) => {
          const roomType = roomDoc.data().type?.toLowerCase() || "other";
          if (roomType.includes("bed")) roomCounts.bedroom++;
          else if (roomType.includes("bath")) roomCounts.bathroom++;
          else if (roomType.includes("kitchen")) roomCounts.kitchen++;
          else if (roomType.includes("living") || roomType.includes("lounge")) roomCounts.livingArea++;
          else roomCounts.other++;
        });

        // Count tasks
        const tasksSnapshot = await db
          .collection("locations")
          .doc(doc.id)
          .collection("tasks")
          .count()
          .get();

        return {
          id: doc.id,
          name: data.name || "Unnamed Location",
          address: data.address || "",
          roomCounts,
          taskCount: tasksSnapshot.data().count,
          totalSqFt: data.squareFootage || null,
        };
      })
    );

    return NextResponse.json({ locations });
  } catch (error: any) {
    console.error("[API] Get organization locations error:", error);
    return NextResponse.json({ error: error.message || "Failed to get locations" }, { status: 500 });
  }
}
