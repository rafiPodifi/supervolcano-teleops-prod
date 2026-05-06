# Archived Routes (Disabled)

Next.js App Router excludes directories whose names start with `_` from
routing. Files in this tree are inert at runtime — the handlers are
preserved for git-history searchability and quick reactivation if needed.

To reactivate a route, `git mv` it back to the equivalent path under
`src/app/api/...`.

## Archived 2026-05 (repo cleanup)

### Admin one-shot migrations (executed once, never re-run)
- `api/admin/migrate/add-organizations`
- `api/admin/migrate/backfill-video-metadata`
- `api/admin/migrate/detect-faces-batch`
- `api/admin/migrate/fix-org-names`
- `api/admin/migrate/remove-partner-id`
- `api/admin/migrate/rename-property-cleaner`
- `api/admin/migrate/split-field-operator-role`
- `api/admin/migrate-location-ids`

### Admin debug / cleanup utilities (no UI callers)
- `api/admin/debug/tasks`
- `api/admin/cleanup-sql-orphans`
- `api/admin/cleanup-tasks`
- `api/admin/fix-test-cleaner`
- `api/admin/seed`
- `api/admin/setup-database`
- `api/admin/init-sql-schema`

### Test/probe endpoints (manual smoke only)
- `api/test-firebase` (and `test-firebase/env`)
- `api/test-firestore`
- `api/test-firestore-read`
- `api/test-firestore-write`
- `api/test-connection`

## Verified active (kept under api/)
- `api/admin/migrate/fix-stuck-uploads` — admin/robot-intelligence/media UI
- `api/admin/migrate/backfill-duration` — admin/robot-intelligence/media UI
- `api/admin/debug/media-count` — admin/debug UI
