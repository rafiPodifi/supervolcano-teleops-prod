# Drizzle Migrations

This is the canonical home for PostgreSQL schema and migrations going
forward.

## Layout

```
drizzle/
  README.md             ← this file
  legacy/               ← pre-2026-05 hand-written SQL (executed once;
                          archived for history)
  meta/                 ← Drizzle migration journal (created by `db:pull`)
  0000_*.sql            ← migration files (created by `db:pull` /
                          `db:generate`)
```

The Drizzle schema source of truth lives at `src/lib/db/schema.ts` (created
on first `npm run db:pull`).

## First-time setup (introspect live DB)

Drizzle has been wired up but **not yet pointed at a live database**.
Run once to generate the baseline:

```bash
# Set POSTGRES_URL_NON_POOLING in .env.local first
npm run db:pull
```

This generates:

- `src/lib/db/schema.ts` — Drizzle schema definitions matching current DB
- `drizzle/0000_baseline.sql` — DDL representing the introspected state
- `drizzle/meta/_journal.json` — migration journal seed

Review the generated schema before committing — Drizzle introspect
sometimes infers types loosely (jsonb → unknown, custom enums → text).

## Adding a migration

```bash
# 1. Edit src/lib/db/schema.ts (add column, table, index, etc.)
# 2. Generate the migration SQL
npm run db:generate
# 3. Review the new drizzle/000N_*.sql file
# 4. Apply
npm run db:migrate
```

## Repository code stays on raw SQL

Drizzle owns schema + migrations. **Repositories continue using raw
SQL** via the `sql` tagged template in `src/lib/db/postgres.ts`. Do not
introduce Drizzle's query builder into repository code without an
explicit decision — it would touch every Robot API endpoint.

## Future GCP cutover

`@neondatabase/serverless` (current driver) does not work against Cloud
SQL. On cutover, swap `src/lib/db/postgres.ts` to `pg` Pool via Cloud
SQL Auth Proxy. The Drizzle migration history travels unchanged.
