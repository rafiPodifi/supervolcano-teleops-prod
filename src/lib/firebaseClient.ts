/**
 * Firebase Client Configuration
 *
 * Required Environment Variables:
 * - NEXT_PUBLIC_FIREBASE_API_KEY
 * - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 * - NEXT_PUBLIC_FIREBASE_PROJECT_ID
 * - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 * - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 * - NEXT_PUBLIC_FIREBASE_APP_ID
 *
 * Database: Uses 'default' (without parentheses) for nam5 multi-region
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, setLogLevel } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// No hardcoded production fallback. Missing NEXT_PUBLIC_* at request time
// must fail loud — silently pointing the browser at the wrong project
// (e.g. the old super-volcano-oem-portal credentials) leaks data and
// confuses users. CI must pass the values as docker --build-arg so they
// are inlined into the bundle.
//
// During `next build` (Vercel/Cloud Run image build) NEXT_PUBLIC_* may
// still be unset when the build is just performing typecheck/prerender;
// we substitute obviously-invalid placeholders so initializeApp() does
// not throw at module load. A real request that hits Firebase will
// surface the configured invalid key as `auth/invalid-api-key` — loud.
const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.NEXT_PHASE === "phase-development-build";

const buildPlaceholder = isBuildPhase ? "build-placeholder" : undefined;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? buildPlaceholder,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? buildPlaceholder,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? buildPlaceholder,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? buildPlaceholder,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? buildPlaceholder,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? buildPlaceholder,
};

function getFirebaseApp(): FirebaseApp {
  if (Object.values(firebaseConfig).some((value) => !value)) {
    throw new Error(
      "Missing Firebase client config. Ensure NEXT_PUBLIC_FIREBASE_* env vars are set at build time (docker --build-arg).",
    );
  }
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export const firebaseApp = getFirebaseApp();

// Enable Firestore debug logging in development
if (
  typeof window !== "undefined" &&
  (process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_FIRESTORE_DEBUG === "true")
) {
  try {
    setLogLevel("debug");
    console.log("[firebase] Firestore debug logging enabled");
  } catch (error) {
    console.warn("Failed to set Firestore log level", error);
  }
}

export const firebaseAuth = getAuth(firebaseApp);
// Identity Platform multi-tenancy: scope auth to the env's tenant.
// Set NEXT_PUBLIC_AUTH_TENANT_ID in .env.{staging,production}.
const tenantId = process.env.NEXT_PUBLIC_AUTH_TENANT_ID;
if (tenantId) {
  firebaseAuth.tenantId = tenantId;
}
export const auth = firebaseAuth;

// Firestore named database per env (staging-db, prod-db). Falls back to
// the legacy "default" DB if no env var is set.
const firestoreDatabaseId =
  process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID ?? "default";
export const firestore = getFirestore(firebaseApp, firestoreDatabaseId);
export const db = firestore;
export const storage = getStorage(firebaseApp);
