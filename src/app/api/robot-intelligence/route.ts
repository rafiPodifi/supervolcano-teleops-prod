/**
 * ROBOT INTELLIGENCE API
 * OEM partners query robot training data.
 * Auth: API key (Firestore-backed) → robot_intelligence table (Postgres).
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sql } from "@/lib/db/postgres";
import { apiKeys, apiUsage } from "@/lib/repositories/apiKeysFirestore";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API key. Include X-API-Key header." },
        { status: 401 },
      );
    }

    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
    const keyDoc = await apiKeys.findActiveByHash(keyHash);
    if (!keyDoc) {
      return NextResponse.json(
        { error: "Invalid or inactive API key" },
        { status: 401 },
      );
    }

    const { organizationId, organizationName } = keyDoc;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000);
    const offset = parseInt(searchParams.get("offset") || "0");
    const locationId = searchParams.get("locationId");
    const taskId = searchParams.get("taskId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const conditions = ["organization_id = $1"];
    const params: any[] = [organizationId];
    let i = 2;

    if (locationId) {
      conditions.push(`location_id = $${i++}`);
      params.push(locationId);
    }
    if (taskId) {
      conditions.push(`task_id = $${i++}`);
      params.push(taskId);
    }
    if (startDate) {
      conditions.push(`created_at >= $${i++}`);
      params.push(new Date(startDate));
    }
    if (endDate) {
      conditions.push(`created_at <= $${i++}`);
      params.push(new Date(endDate));
    }

    const whereClause = conditions.join(" AND ");

    const dataQuery = `
      SELECT
        firebase_id as id, task_id, location_id, user_id,
        completion_time, accuracy, errors, video_url, thumbnail_url,
        annotations, file_size, duration, created_at, updated_at
      FROM robot_intelligence
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${i} OFFSET $${i + 1}
    `;
    params.push(limit, offset);
    const dataResult = await sql.query(dataQuery, params);
    const rows = Array.isArray(dataResult) ? dataResult : dataResult.rows;

    const countResult = await sql.query(
      `SELECT COUNT(*) as total FROM robot_intelligence WHERE ${whereClause}`,
      params.slice(0, -2),
    );
    const countRows = Array.isArray(countResult)
      ? countResult
      : countResult.rows;
    const total = parseInt(countRows[0].total);

    // Fire-and-forget usage tracking + last-used touch (no await blocking response).
    void apiUsage.record({
      organizationId,
      endpoint: "/api/robot-intelligence",
      method: "GET",
      statusCode: 200,
    });
    void apiKeys.touchLastUsed(keyDoc.id);

    return NextResponse.json({
      success: true,
      organization: organizationName,
      data: rows,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
      filters: { locationId, taskId, startDate, endDate },
    });
  } catch (error: any) {
    console.error("[Robot Intelligence API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
