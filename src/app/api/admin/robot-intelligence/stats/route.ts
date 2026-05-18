/**
 * GET /api/admin/robot-intelligence/stats
 *
 * Data sources after 2026-05 redesign:
 *   - locations, media, jobs → Firestore
 *   - shifts, robot_executions → Postgres (analytics-only)
 */

import { NextResponse } from "next/server";
import { sql } from "@/lib/db/postgres";
import { adminDb } from "@/lib/firebaseAdmin";
import { getUserClaims, requireRole } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

async function countFirestore(collection: string): Promise<number> {
  try {
    const snap = await adminDb.collection(collection).count().get();
    return snap.data().count;
  } catch (e) {
    console.error(`[Stats] Error counting Firestore ${collection}:`, e);
    return 0;
  }
}

async function countPostgres(table: string): Promise<number> {
  try {
    const r = await sql.query(`SELECT COUNT(*)::int as count FROM ${table}`);
    const rows = Array.isArray(r) ? r : r.rows;
    return Number(rows?.[0]?.count ?? 0);
  } catch (e) {
    console.log(`[Stats] Postgres table ${table} unavailable or empty`);
    return 0;
  }
}

export async function GET(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const claims = await getUserClaims(token);
    if (!claims)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    requireRole(claims, ["superadmin", "admin", "partner_admin"]);

    const [locations, media, tasks, shifts, executions] = await Promise.all([
      countFirestore("locations"),
      countFirestore("media"),
      countFirestore("jobs"),
      countPostgres("shifts"),
      countPostgres("robot_executions"),
    ]);

    return NextResponse.json({
      locations,
      media,
      tasks,
      shifts,
      executions,
    });
  } catch (error: any) {
    console.error("[Stats] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load stats" },
      { status: 500 },
    );
  }
}
