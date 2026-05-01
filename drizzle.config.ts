import type { Config } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * Schema is owned by Drizzle from 2026-05 onward (introspected baseline
 * + future migrations). Repository code keeps using raw SQL via the
 * `sql` template in src/lib/db/postgres.ts — Drizzle is for schema
 * management only, not query building.
 *
 * Usage:
 *   npm run db:pull        # introspect live DB → src/lib/db/schema.ts
 *   npm run db:generate    # generate migration from schema diff
 *   npm run db:migrate     # apply pending migrations
 *   npm run db:studio      # open Drizzle Studio
 */
export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.POSTGRES_URL ??
      process.env.DATABASE_URL ??
      "",
  },
  verbose: true,
  strict: true,
} satisfies Config;
