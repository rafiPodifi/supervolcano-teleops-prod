/**
 * GET /api/admin/training
 *
 * List training corpus videos (anonymized)
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getUserClaims, requireRole } from "@/lib/utils/auth";
import { sql } from "@/lib/db/postgres";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    await adminAuth.verifyIdToken(token);

    const claims = await getUserClaims(token);
    if (!claims) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    requireRole(claims, ["superadmin", "admin", "partner_admin"]);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const roomType = searchParams.get("roomType");
    const actionType = searchParams.get("actionType");
    const objectLabel = searchParams.get("objectLabel");
    const featuredOnly = searchParams.get("featured") === "true";
    const minQuality = parseFloat(searchParams.get("minQuality") || "0");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    const queryParts = [
      `SELECT * FROM training_videos WHERE quality_score >= $1`,
    ];
    const params: any[] = [minQuality];
    let paramIndex = 2;

    if (roomType) {
      queryParts.push(` AND room_type = $${paramIndex++}`);
      params.push(roomType);
    }

    if (actionType) {
      queryParts.push(` AND $${paramIndex++} = ANY(action_types)`);
      params.push(actionType);
    }

    if (objectLabel) {
      queryParts.push(` AND $${paramIndex++} = ANY(object_labels)`);
      params.push(objectLabel);
    }

    if (featuredOnly) {
      queryParts.push(` AND is_featured = true`);
    }

    queryParts.push(` ORDER BY quality_score DESC, created_at DESC`);
    queryParts.push(` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`);
    params.push(limit, offset);

    const query = queryParts.join(" ");
    const result = await sql.query(query, params);
    const rows = Array.isArray(result) ? result : result.rows;

    // Get stats
    const statsResult = await sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(DISTINCT room_type)::int as room_types,
        AVG(quality_score)::float as avg_quality,
        SUM(duration_seconds)::bigint as total_duration
      FROM training_videos
    `;
    const statsRows = Array.isArray(statsResult)
      ? statsResult
      : statsResult.rows;

    return NextResponse.json({
      videos: rows || [],
      stats: statsRows?.[0] || {
        total: 0,
        room_types: 0,
        avg_quality: 0,
        total_duration: 0,
      },
      pagination: {
        limit,
        offset,
        hasMore: (rows?.length || 0) === limit,
      },
    });
  } catch (error: any) {
    console.error("[API] Training list error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch training videos" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/training
 *
 * Update training video metadata (feature, tags, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    await adminAuth.verifyIdToken(token);

    const claims = await getUserClaims(token);
    if (!claims) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    requireRole(claims, ["superadmin", "admin"]);

    const body = await request.json();
    const { id, is_featured, technique_tags } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const updates: string[] = [];
    const params: any[] = [id];
    let paramIndex = 2;

    if (typeof is_featured === "boolean") {
      updates.push(`is_featured = $${paramIndex++}`);
      params.push(is_featured);
    }

    if (Array.isArray(technique_tags)) {
      updates.push(`technique_tags = $${paramIndex++}`);
      params.push(technique_tags);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 },
      );
    }

    const query = `
      UPDATE training_videos 
      SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await sql.query(query, params);
    const rows = Array.isArray(result) ? result : result.rows;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json({ video: rows[0] });
  } catch (error: any) {
    console.error("[API] Training update error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update training video" },
      { status: 500 },
    );
  }
}
