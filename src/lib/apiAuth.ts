import { NextRequest } from "next/server";

import { adminAuth } from "@/lib/firebaseAdmin";

const ADMIN_TOKEN = process.env.ADMIN_BEARER_TOKEN ?? "";

function matchesSharedSecret(value: string | null) {
  if (!value) return false;
  return ADMIN_TOKEN ? value === ADMIN_TOKEN : false;
}

export async function requireAdmin(req: NextRequest) {
  const directHeader = req.headers.get("admin_bearer_token") ?? req.headers.get("ADMIN_BEARER_TOKEN");
  if (matchesSharedSecret(directHeader)) {
    return true;
  }

  const authorization = req.headers.get("authorization") ?? "";
  const normalized = authorization.toLowerCase();

  if (normalized.startsWith("bearer ")) {
    const token = authorization.split(/\s+/)[1] ?? "";
    
    // Check shared secret first
    if (matchesSharedSecret(token)) {
      return true;
    }
    
    // Try to verify as Firebase token
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      const role = decoded?.role;
      return role === "admin" || role === "superadmin" || role === "partner_admin";
    } catch {
      // Not a valid Firebase token, continue
    }
  }

  let firebaseToken = req.headers.get("x-firebase-token") ?? "";
  if (!firebaseToken && normalized.startsWith("firebase ")) {
    firebaseToken = authorization.split(/\s+/)[1] ?? "";
  }

  if (!firebaseToken) {
    return false;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(firebaseToken);
    const role = decoded?.role;
    return role === "admin" || role === "superadmin" || role === "partner_admin";
  } catch (error) {
    console.error("Failed to verify Firebase token", error);
    return false;
  }
}
