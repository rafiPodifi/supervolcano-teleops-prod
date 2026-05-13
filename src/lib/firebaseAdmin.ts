/**
 * Firebase Admin SDK Configuration
 *
 * Required Environment Variables (must be in .env.local):
 * - FIREBASE_ADMIN_PROJECT_ID: Firebase project ID (e.g., "super-volcano-oem-portal")
 * - FIREBASE_ADMIN_CLIENT_EMAIL: Service account email from Firebase Console
 * - FIREBASE_ADMIN_PRIVATE_KEY: Service account private key (with \n characters preserved)
 * - FIRESTORE_DATABASE_ID: Optional, defaults to "default" for nam5 multi-region
 *
 * Database: Uses 'default' (without parentheses) for nam5 multi-region
 *
 * How to get credentials:
 * 1. Go to Firebase Console → Project Settings → Service Accounts
 * 2. Click "Generate new private key"
 * 3. Download JSON file
 * 4. Extract: project_id → FIREBASE_ADMIN_PROJECT_ID
 *            client_email → FIREBASE_ADMIN_CLIENT_EMAIL
 *            private_key → FIREBASE_ADMIN_PRIVATE_KEY (keep \n characters!)
 */

import {
  App,
  applicationDefault,
  cert,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Boot-time env validation. Fails fast on misconfigured deployments.
import "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var firebaseAdminApp: App | undefined;
  // eslint-disable-next-line no-var
  var firebaseAdminDb: ReturnType<typeof getFirestore> | undefined;
}

/**
 * Get or initialize Firebase Admin App (singleton pattern)
 */
export function getAdminApp(): App {
  if (typeof window !== "undefined") {
    throw new Error("Firebase Admin SDK must only be used on the server.");
  }

  if (global.firebaseAdminApp) {
    return global.firebaseAdminApp;
  }

  // During Next.js build phase, env vars may not be available
  // Return a mock app to allow build to complete
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-development-build"
  ) {
    const missing = [
      "FIREBASE_ADMIN_PROJECT_ID",
      "FIREBASE_ADMIN_CLIENT_EMAIL",
      "FIREBASE_ADMIN_PRIVATE_KEY",
    ].filter((key) => !process.env[key]);

    if (missing.length > 0) {
      console.warn(
        `[Firebase Admin] Build phase detected with missing env vars: ${missing.join(", ")}. Using mock app.`,
      );
      // Return a mock app object with methods Firebase Admin SDK expects
      const mockApp = {
        _delegate: {},
        options: {},
        getOrInitService: () => ({}),
      } as any as App;
      global.firebaseAdminApp = mockApp;
      return mockApp;
    }
  }

  // On GCP (Cloud Run, Cloud Functions, etc.) use Application Default
  // Credentials — no service account JSON needed. Locally fall back to
  // FIREBASE_ADMIN_* service account env vars.
  const useADC =
    !process.env.FIREBASE_ADMIN_PRIVATE_KEY &&
    !process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT;

  if (!projectId) {
    throw new Error(
      "Missing project ID: set FIREBASE_ADMIN_PROJECT_ID or GOOGLE_CLOUD_PROJECT",
    );
  }

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;

  console.log(
    "[Firebase Admin] Initializing with project:",
    projectId,
    useADC ? "(ADC)" : "(service account)",
  );

  const app = useADC
    ? initializeApp({
        credential: applicationDefault(),
        projectId,
        storageBucket,
      })
    : initializeApp({
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replaceAll(
            "\\n",
            "\n",
          ),
        }),
        storageBucket,
      });

  global.firebaseAdminApp = app;
  console.log("[Firebase Admin] Initialized successfully");

  return app;
}

/**
 * Get or initialize Firestore instance (singleton pattern)
 */
export function getAdminDb() {
  if (global.firebaseAdminDb) {
    return global.firebaseAdminDb;
  }

  const app = getAdminApp();

  // During build phase with mock app, return a mock db
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-development-build"
  ) {
    const requiredEnvVars = [
      "FIREBASE_ADMIN_PROJECT_ID",
      "FIREBASE_ADMIN_CLIENT_EMAIL",
      "FIREBASE_ADMIN_PRIVATE_KEY",
    ];
    const missing = requiredEnvVars.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      // Return a minimal mock db object that won't cause errors
      const mockDb = {
        collection: () => ({
          doc: () => ({ id: "mock-id" }),
          where: () => ({
            limit: () => ({ get: async () => ({ empty: true, docs: [] }) }),
          }),
        }),
      } as any as ReturnType<typeof getFirestore>;
      global.firebaseAdminDb = mockDb;
      return mockDb;
    }
  }

  const databaseId = process.env.FIRESTORE_DATABASE_ID?.trim() || "default";

  const db = getFirestore(app, databaseId);

  // Settings for Firestore
  db.settings({
    ignoreUndefinedProperties: true,
  });

  global.firebaseAdminDb = db;
  console.log(
    "[Firebase Admin] Firestore initialized with database:",
    databaseId,
  );

  return db;
}

/**
 * Get or initialize Firebase Admin Auth instance (lazy)
 */
export function getAdminAuth() {
  // During build phase with missing env vars, return a mock
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-development-build"
  ) {
    const missing = [
      "FIREBASE_ADMIN_PROJECT_ID",
      "FIREBASE_ADMIN_CLIENT_EMAIL",
      "FIREBASE_ADMIN_PRIVATE_KEY",
    ].filter((key) => !process.env[key]);
    if (missing.length > 0) {
      // Return a mock auth object
      return {
        verifyIdToken: async () => ({ uid: "mock", role: "admin" }),
        getUser: async () => ({ uid: "mock", email: "mock@example.com" }),
        setCustomUserClaims: async () => {},
      } as any as ReturnType<typeof getAuth>;
    }
  }
  const app = getAdminApp();
  return getAuth(app);
}

/**
 * Get or initialize Firebase Admin Storage instance (lazy)
 */
export function getAdminStorage() {
  const app = getAdminApp();
  return getStorage(app);
}

// Export lazy getters (these will be called at runtime, not build time)
export function getFirebaseAdminApp(): App {
  return getAdminApp();
}

// For backward compatibility, export getters that return the instances
// These should be used instead of direct exports to avoid build-time initialization
export const firebaseAdminApp = getAdminApp();
export const adminApp = firebaseAdminApp;
export const adminDb = getAdminDb();
// Note: adminAuth and adminStorage are now functions - use getAdminAuth() and getAdminStorage()
// Keeping these for backward compatibility but they will be called at module load
export const adminAuth = getAdminAuth();
export const adminStorage = getAdminStorage();
