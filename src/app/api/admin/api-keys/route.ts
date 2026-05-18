/**
 * API KEY MANAGEMENT
 * Admins create API keys for OEM partners.
 * Backed by Firestore (collection: apiKeys).
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminAuth } from "@/lib/firebaseAdmin";
import { apiKeys } from "@/lib/repositories/apiKeysFirestore";

export const dynamic = "force-dynamic";

function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `sk_${crypto.randomBytes(32).toString("hex")}`;
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const prefix = key.substring(0, 10);
  return { key, hash, prefix };
}

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 as const };
  }
  const token = authHeader.split("Bearer ")[1];
  const decoded = await getAdminAuth().verifyIdToken(token);
  if (decoded.role !== "admin" && decoded.role !== "superadmin") {
    return { error: "Forbidden", status: 403 as const };
  }
  return { uid: decoded.uid };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth)
      return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { organizationId, organizationName, expiresInDays } =
      await request.json();

    if (!organizationId || !organizationName) {
      return NextResponse.json(
        { error: "organizationId and organizationName required" },
        { status: 400 },
      );
    }

    const { key, hash, prefix } = generateApiKey();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const keyId = await apiKeys.create({
      keyHash: hash,
      keyPrefix: prefix,
      organizationId,
      organizationName,
      createdBy: auth.uid,
      expiresAt,
    });

    return NextResponse.json({
      success: true,
      apiKey: key,
      keyId,
      organizationId,
      organizationName,
      expiresAt,
      warning: "Save this API key now. You will not be able to see it again.",
    });
  } catch (error: any) {
    console.error("[API Keys] POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth)
      return NextResponse.json({ error: auth.error }, { status: auth.status });

    const rows = await apiKeys.list();
    return NextResponse.json({ success: true, apiKeys: rows });
  } catch (error: any) {
    console.error("[API Keys] GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
