# Archived Scripts

These scripts ran once during 2025–2026 data migrations and ad-hoc audits.
Preserved here for traceability. Not referenced by `package.json` scripts.

If you need to re-run one, copy it back to `scripts/` and re-add the npm
script entry. Most are non-idempotent — read each before invoking.

## Inventory

### One-off data migrations (Firestore → SQL replica era)
- `migrate-to-locations.ts` — legacy `properties` → `locations` rename
- `migrate-to-organizations.ts` — flat users → organizations structure
- `run-migration.ts`, `run-migration-chunked.ts`, `run-migration-fixed.ts`,
  `run-migration-step-by-step.ts` — variants of the same migration
- `fix-roles.ts` — one-shot role normalization
- `update-all-passwords.ts` — bulk password rotation

### Ad-hoc shell helpers (Vercel deploy era)
- `run-migration.sh`, `verify-migration.sh` — deploy + DB migration runner
- `check-deliveries.cjs`, `cleanup-duplicates.cjs`, `verify-parents.cjs`,
  `check-sources.cjs`, `check-sources.js` — Firestore content audits

### Historical reference
- `MIGRATION_README.md` — original 2025 migration notes
