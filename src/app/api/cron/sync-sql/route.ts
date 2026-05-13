/**
 * CRON ENDPOINT: Firebase → PostgreSQL Sync
 * Syncs videos/training data from Firebase to PostgreSQL every 5 minutes
 */

import { NextRequest, NextResponse } from "next/server";
import { firebaseToSQLSync } from "@/services/firebase-to-sql-sync.service";
import { verifyCronOidc } from "@/lib/auth/cron";

export const maxDuration = 300; // 5 minutes max execution time

async function handle(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const url = new URL(request.url);
    const audience = `${url.protocol}//${url.host}`;
    try {
      const verified = await verifyCronOidc(authHeader, audience);
      if (!verified) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } catch (err) {
      console.error("[Cron] OIDC verification failed:", err);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Cron] Starting Firebase → PostgreSQL sync...");
    const startTime = Date.now();

    const stats = await firebaseToSQLSync.syncRobotIntelligence();

    const duration = Date.now() - startTime;
    console.log(`[Cron] Sync completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      stats,
      duration,
      direction: "firebase_to_postgresql",
    });
  } catch (error: any) {
    console.error("[Cron] Sync failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  } finally {
    await firebaseToSQLSync.disconnect();
  }
}

// Cloud Scheduler defaults to POST; keep GET working for manual smoke tests.
export const GET = handle;
export const POST = handle;
