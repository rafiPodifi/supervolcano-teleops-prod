/**
 * Environment Variables Check Endpoint
 * 
 * Verifies all required Firebase environment variables are set.
 * 
 * URL: http://localhost:3000/api/test-firebase/env
 */

import { NextResponse } from "next/server";

export async function GET() {
  const envVars = {
    FIREBASE_ADMIN_PROJECT_ID:
      process.env.FIREBASE_ADMIN_PROJECT_ID || "MISSING",
    FIREBASE_ADMIN_CLIENT_EMAIL: process.env.FIREBASE_ADMIN_CLIENT_EMAIL
      ? "SET (hidden)"
      : "MISSING",
    FIREBASE_ADMIN_PRIVATE_KEY: process.env.FIREBASE_ADMIN_PRIVATE_KEY
      ? "SET (hidden)"
      : "MISSING",
    FIRESTORE_DATABASE_ID:
      process.env.FIRESTORE_DATABASE_ID || "MISSING (will use 'default')",
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY
      ? "SET (hidden)"
      : "MISSING",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "MISSING",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "MISSING",
  };

  const requiredAdminVars = [
    "FIREBASE_ADMIN_PROJECT_ID",
    "FIREBASE_ADMIN_CLIENT_EMAIL",
    "FIREBASE_ADMIN_PRIVATE_KEY",
  ];

  const missingAdminVars = requiredAdminVars.filter(
    (key) => !process.env[key],
  );

  const allSet = missingAdminVars.length === 0;

  return NextResponse.json({
    allSet,
    missingAdminVars,
    environment: envVars,
    message: allSet
      ? "✅ All required environment variables are set"
      : `❌ Missing required environment variables: ${missingAdminVars.join(", ")} - check .env.local`,
  });
}

