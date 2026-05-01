/**
 * GET /api/robot/v1/training
 *
 * Public API for robot OEMs to query training corpus
 * Requires API key authentication
 * Returns ONLY anonymized data (no PII)
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/postgres";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // API key authentication
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.ROBOT_API_KEY) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roomType = searchParams.get("room_type");
    const actionTypes = searchParams.getAll("action_type");
    const objectLabels = searchParams.getAll("object_label");
    const minQuality = parseFloat(searchParams.get("min_quality") || "0.5");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

    // Build query
    const queryParts = [
      `SELECT 
        id,
        video_url,
        room_type,
        action_types,
        object_labels,
        technique_tags,
        duration_seconds,
        quality_score
      FROM training_videos
      WHERE quality_score >= $1`,
    ];

    const params: any[] = [minQuality];
    let paramIndex = 2;

    if (roomType) {
      queryParts.push(` AND room_type = $${paramIndex++}`);
      params.push(roomType);
    }

    for (const action of actionTypes) {
      queryParts.push(` AND $${paramIndex++} = ANY(action_types)`);
      params.push(action);
    }

    for (const obj of objectLabels) {
      queryParts.push(` AND $${paramIndex++} = ANY(object_labels)`);
      params.push(obj);
    }

    queryParts.push(` ORDER BY quality_score DESC LIMIT $${paramIndex++}`);
    params.push(limit);

    const query = queryParts.join(" ");
    const result = await sql.query(query, params);
    const rows = Array.isArray(result) ? result : result.rows;

    // Increment view counts (fire and forget)
    const ids = rows?.map((r: any) => r.id) || [];
    if (ids.length > 0) {
      // Use a UUID array for the query
      sql`
        UPDATE training_videos 
        SET view_count = view_count + 1 
        WHERE id = ANY(${ids}::uuid[])
      `.catch((err) =>
        console.error("[Robot API] Failed to increment view counts:", err),
      );
    }

    return NextResponse.json({
      videos: rows || [],
      count: rows?.length || 0,
      query: {
        room_type: roomType,
        action_types: actionTypes,
        object_labels: objectLabels,
        min_quality: minQuality,
      },
    });
  } catch (error: any) {
    console.error("[Robot API] Training query error:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
