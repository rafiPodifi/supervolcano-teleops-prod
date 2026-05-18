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

    // Firestore reads `jobs` collection. Media joined client-side via
    // separate query per job (small N today; revisit if list grows).
    const jobsSnap = await adminDb
      .collection("jobs")
      .orderBy("createdAt", "desc")
      .get();

    const jobs = await Promise.all(
      jobsSnap.docs.map(async (doc) => {
        const data = doc.data();
        const mediaSnap = await adminDb
          .collection("media")
          .where("jobId", "==", doc.id)
          .get();
        const media = mediaSnap.docs.map((m) => {
          const d = m.data();
          return {
            id: m.id,
            storage_url: d.storageUrl ?? d.storage_url ?? null,
            thumbnail_url: d.thumbnailUrl ?? d.thumbnail_url ?? null,
            file_type: d.fileType ?? d.file_type ?? null,
            duration_seconds: d.durationSeconds ?? d.duration_seconds ?? null,
          };
        });
        return {
          id: doc.id,
          title: data.title ?? null,
          description: data.description ?? null,
          category: data.category ?? null,
          priority: data.priority ?? null,
          location_id: data.locationId ?? data.location_id ?? null,
          location_name: data.locationName ?? data.location_name ?? null,
          location_address:
            data.locationAddress ?? data.location_address ?? null,
          estimated_duration_minutes:
            data.estimatedDurationMinutes ??
            data.estimated_duration_minutes ??
            null,
          status: data.status ?? null,
          created_at: data.createdAt ?? null,
          updated_at: data.updatedAt ?? null,
          media,
        };
      }),
    );

    return NextResponse.json(
      {
        success: true,
        jobs,
        count: jobs.length,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error: any) {
    console.error("Failed to fetch jobs:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
