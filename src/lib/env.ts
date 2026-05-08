import { z } from "zod";

/**
 * Server env validator. Imported once in firebaseAdmin.ts so the app
 * fails fast at boot if required vars are missing or malformed.
 *
 * Vercel build phase (`next build` collecting page data) may run
 * without secrets — we skip validation in that case to keep CI builds
 * green; runtime is still validated.
 */
const serverSchema = z
  .object({
    // On GCP (Cloud Run, etc.) GOOGLE_CLOUD_PROJECT is auto-injected.
    // Locally, set FIREBASE_ADMIN_PROJECT_ID. firebaseAdmin.ts requires
    // one of them at runtime.
    FIREBASE_ADMIN_PROJECT_ID: z.string().min(1).optional(),
    GOOGLE_CLOUD_PROJECT: z.string().min(1).optional(),
    FIREBASE_ADMIN_CLIENT_EMAIL: z.string().email().optional(),
    FIREBASE_ADMIN_PRIVATE_KEY: z.string().min(1).optional(),
    FIRESTORE_DATABASE_ID: z.string().default("default"),
    FIREBASE_STORAGE_BUCKET: z.string().optional(),

    POSTGRES_URL: z.string().url().optional(),
    POSTGRES_URL_NON_POOLING: z.string().url().optional(),
    DATABASE_URL: z.string().url().optional(),
    SQL_HOST: z.string().optional(),
    SQL_USER: z.string().optional(),
    SQL_PASSWORD: z.string().optional(),
    SQL_DATABASE: z.string().optional(),

    CRON_SECRET: z.string().min(16).optional(),
    ADMIN_BEARER_TOKEN: z.string().optional(),
    MIGRATION_SECRET_KEY: z.string().optional(),
    ROBOT_API_KEY: z.string().optional(),

    GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
    GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),

    VIDEO_BLUR_PROCESSOR_URL: z.string().url().optional(),
    VIDEO_BLUR_PROCESSOR_KEY: z.string().optional(),

    NODE_ENV: z.enum(["development", "production", "test"]).optional(),
    NEXT_PHASE: z.string().optional(),
  })
  .refine(
    (val) => Boolean(val.FIREBASE_ADMIN_PROJECT_ID || val.GOOGLE_CLOUD_PROJECT),
    {
      message:
        "Set FIREBASE_ADMIN_PROJECT_ID or GOOGLE_CLOUD_PROJECT (auto-injected on GCP)",
      path: ["FIREBASE_ADMIN_PROJECT_ID"],
    },
  );

export type ServerEnv = z.infer<typeof serverSchema>;

const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

function loadEnv(): ServerEnv {
  if (isBuildPhase) {
    return process.env as unknown as ServerEnv;
  }
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid server environment variables:\n${issues}\n\n` +
        `See .env.example for the full schema.`,
    );
  }
  return result.data;
}

export const env = loadEnv();
