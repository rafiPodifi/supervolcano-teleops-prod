# Postgres Audit & Redesign Plan — 2026-05-18

Author: pairing session with Claude. Source-of-truth = code as of commit `0bd355c`.

## TL;DR

- ~30 live routes hit Postgres. Most are CRUD that duplicates Firestore.
- True Postgres workloads: training corpus (GIN search), robot analytics, audit/usage tables.
- Recommendation: **shrink Postgres to 7 tables**, migrate the rest to Firestore.

## Classification

Three buckets:

- **KEEP_POSTGRES** — analytics, GIN search, external robot API, audit writes. Postgres genuinely wins.
- **MIGRATE_TO_FIRESTORE** — CRUD on small/medium collections. Firestore already holds the canonical data; Postgres copy drifts.
- **DEAD** — no UI caller, no robot caller, not referenced by other live code.

### KEEP_POSTGRES (10 routes, 7 tables)

| Route                                     | Why Postgres                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| `GET /api/admin/training`                 | GIN array search on `action_types/object_labels/technique_tags` + `AVG/SUM` stats |
| `PATCH /api/admin/training`               | training_videos metadata edit                                                     |
| `GET /api/admin/robot-intelligence/stats` | `COUNT(*)` across media/jobs/shifts/executions                                    |
| `GET /api/robot/v1/training`              | GIN search (robot consumer)                                                       |
| `POST /api/robot/v1/feedback`             | append-only writes to `robot_executions`                                          |
| `POST /api/robot/v1/query`                | multi-join query for robot context                                                |
| `GET /api/robot/jobs`                     | JOIN + GROUP BY across jobs/tasks/media (robot)                                   |
| `GET /api/robot/locations`                | JOIN + GROUP BY (robot)                                                           |
| `GET /api/robot/locations/[id]`           | flat structure read (robot)                                                       |
| `GET /api/robot/locations/[id]/jobs`      | JOIN + GROUP BY (robot)                                                           |
| `GET /api/robot/sessions`                 | list `shifts` w/ pagination                                                       |

**Tables to keep:**

1. `training_videos` — anonymized training corpus
2. `robot_executions` — append-only robot execution log
3. `shifts` — robot session log
4. `api_keys` — robot API auth (hot path; ms latency matters)
5. `api_usage` — rate-limit / usage tracking
6. `robot_intelligence` — sync target for daily Firestore→Postgres job
7. Plus **denormalized read-replicas** for robot routes (see below)

**Critical design choice:** robot routes need `locations`, `jobs`, `tasks`, `media` data. Two options:

- **(a)** Keep those as sync'd read-replicas in Postgres (current model, drift risk).
- **(b)** Have robot routes query Firestore directly (no Postgres for them).

Recommendation: **(b)**. Robots can tolerate Firestore latency (they're not real-time servo loops). Drops 6 tables. Eliminates sync surface for those.

If (b), KEEP shrinks to: `training_videos`, `robot_executions`, `shifts`, `api_keys`, `api_usage`, `robot_intelligence` → **6 tables**.

### MIGRATE_TO_FIRESTORE (20 routes)

All already have Firestore counterparts or trivial-to-add. Postgres copy is duplicate-and-drifting.

| Route                                                 | Operation                      | Firestore equivalent (exists?)                              |
| ----------------------------------------------------- | ------------------------------ | ----------------------------------------------------------- |
| `GET/POST /api/admin/jobs`                            | CRUD jobs                      | yes — `/jobs` collection                                    |
| `GET/POST /api/admin/library/action-types`            | CRUD lookup                    | new — `/library/actionTypes`                                |
| `GET/POST /api/admin/library/room-types`              | CRUD lookup                    | new — `/library/roomTypes`                                  |
| `GET/POST /api/admin/library/target-types`            | CRUD lookup                    | new — `/library/targetTypes`                                |
| `GET/POST /api/admin/locations`                       | CRUD locations                 | yes — `/api/admin/locations/firestore` already exists       |
| `POST /api/admin/locations/[id]/generate-tasks`       | bulk insert jobs               | yes — read taxonomy from Firestore, write jobs to Firestore |
| `POST /api/admin/locations/[id]/rooms`                | CRUD location_rooms            | new — subcollection                                         |
| `GET/POST /api/admin/locations/[id]/structure`        | CRUD floors+rooms              | new — subcollection                                         |
| `GET /api/admin/robot-intelligence/locations`         | list locations                 | yes — Firestore `/locations`                                |
| `GET /api/admin/robot-intelligence/tasks`             | list jobs by location          | yes — Firestore filter                                      |
| `POST /api/admin/rooms/[id]/targets`                  | CRUD                           | new — subcollection                                         |
| `POST /api/admin/sync/all`                            | Firestore → Postgres bulk sync | **delete** (no longer needed)                               |
| `POST /api/admin/targets/[id]/actions`                | CRUD                           | new — subcollection                                         |
| `DELETE/PATCH /api/admin/tasks/[id]`                  | delete job + media             | yes — Firestore batch                                       |
| `GET/POST /api/admin/taxonomy/categories`             | CRUD lookup                    | new — `/library/taskCategories`                             |
| `PATCH/DELETE /api/admin/taxonomy/categories/[id]`    | CRUD                           | new                                                         |
| `GET/POST /api/admin/taxonomy/templates`              | CRUD                           | new — `/library/taskTemplates`                              |
| `GET/PATCH/DELETE /api/admin/taxonomy/templates/[id]` | CRUD                           | new                                                         |
| `POST /api/admin/taxonomy/templates/[id]/create-task` | instantiate template → job     | yes — Firestore write                                       |
| `GET/POST /api/v1/locations`                          | CRUD locations                 | yes — Firestore `/locations`                                |

### DEAD (0 routes — pending confirmation)

Suspected but need confirmation before delete:

| Path                                                       | Why suspect                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/app/api/admin/robot-intelligence/stats/route.ts.bak`  | `.bak` file — delete                                                        |
| `src/app/_archived/api/admin/cleanup-sql-orphans/route.ts` | already archived — delete dir                                               |
| `src/lib/repositories/sql/locationPreferences.ts`          | only used by `/api/robot/v1/query`; if robot routes move off Postgres, kill |
| `src/lib/repositories/sql/tasks.ts`                        | only used by `/api/admin/tasks/[id]` and sync — kill after migrate          |
| `src/lib/services/sync/firestoreToSql.ts`                  | becomes obsolete once `MIGRATE_TO_FIRESTORE` complete                       |
| `src/services/firebase-to-sql-sync.service.ts`             | shrinks to robot_intelligence only; rename to reflect smaller scope         |

## Recommended target schema

**Drizzle source-of-truth: `src/lib/db/schema.ts`** (~6 tables).

```
training_videos      -- GIN search, admin curation
robot_executions     -- append-only log from /api/robot/v1/feedback
shifts               -- robot session log
api_keys             -- robot auth (hot path)
api_usage            -- rate limit / usage analytics
robot_intelligence   -- daily Firestore→Postgres sync target
```

Drop entirely: `locations`, `location_floors`, `location_rooms`, `location_targets`, `location_preferences`, `room_types`, `target_types`, `target_actions`, `action_types`, `task_categories`, `task_templates`, `tasks`, `jobs`, `media`, `task_media`, `location_assignments`.

## Risks / Decisions Needed

1. **Robot routes off Postgres** — confirm robot consumers don't have latency budget < 200ms. If they do, keep small Postgres replicas (sync surface grows).
2. **api_keys / api_usage** — currently in Postgres; could move to Firestore. Cost: every API call does a Firestore lookup (~30–80ms p50) vs Postgres (~3–8ms). For high-RPS robot API → keep Postgres.
3. **Taxonomy CRUD scale** — lookup tables (room_types, action_types, etc.) are tiny (10–50 rows). Firestore is overkill but fine. Could also live in code as TS constants.
4. **DELETE cascades** — `DELETE FROM jobs` currently cascades to `media` via FK. Firestore batches must replicate this manually.

## Phases

**Phase A — Quick wins (today, already started):**

- ✅ `training_videos` table provisioned (phase 1 of original fix)
- Provision other KEEP tables via Drizzle migration

**Phase B.1 — Taxonomy + library to Firestore (✅ done 2026-05-18):**

- New repo `src/lib/repositories/taxonomyFirestore.ts`
- Rewrote 7 routes: action-types, room-types, target-types, taxonomy/categories (×2), taxonomy/templates (×2)
- Added Firestore rules for new collections
- Migration: snake_case fields kept → zero FE change

**Phase B.2 — Locations + jobs + tasks to Firestore (✅ done 2026-05-18, partial):**

- Stripped Postgres dual-writes:
  - `POST /api/admin/locations` (Firestore-only now)
  - `POST /api/admin/locations/[id]/structure` (nested subcollections — already Firestore, removed trailing SQL sync)
  - `DELETE/PATCH /api/admin/tasks/[id]` (removed jobs/media SQL deletes)
  - `POST /api/v1/locations` (removed syncLocation call)
- Rewrote pure-Postgres routes to Firestore:
  - `POST /api/admin/locations/[id]/rooms` → flat `locationRooms`
  - `POST /api/admin/rooms/[id]/targets` → flat `locationTargets`
  - `POST /api/admin/targets/[id]/actions` → flat `targetActions`
  - `POST /api/admin/locations/[id]/generate-tasks` (reads structure from flat Firestore + taxonomy)
  - `GET /api/admin/jobs` (Firestore jobs collection)
  - `GET /api/admin/robot-intelligence/locations` (Firestore)
  - `GET /api/admin/robot-intelligence/tasks` (Firestore jobs)
  - `GET /api/admin/robot-intelligence/stats` (locations/media/jobs from Firestore; shifts/executions still Postgres)
  - `POST /api/admin/taxonomy/templates/[id]/create-task` (Firestore writes; uses taxonomy repo for template read)
- Deleted:
  - `src/app/api/admin/sync/all/route.ts`
  - `src/app/api/admin/robot-intelligence/stats/route.ts.bak`

**Phase B.2-tail (✅ done 2026-05-18):**

Migrated to Firestore:

- `/api/admin/tasks` (GET + POST) — `tasks` collection
- `/api/org/preferences` (POST + DELETE) — `locationPreferences` collection, deterministic upsert id `${locationId}__${taskId}`
- `/api/org/locations/[id]/preferences` (GET) — `locationPreferences` filtered by `locationId`
- Firestore rules: `locationPreferences` RW for admin + manager

Deleted (no UI caller, Postgres-only):

- `/api/admin/tasks/generate/route.ts`
- `/api/admin/sync/route.ts`
- `/api/admin/sync-media/route.ts`
- `/api/admin/test-media-sync/route.ts`
- `/api/org/locations/[id]/moments/route.ts`
- `src/lib/repositories/sql/tasks.ts` (+ empty dir)
- `src/lib/repositories/sql/locationPreferences.ts`
- `src/lib/services/sync/firestoreToSql.ts` (+ empty dir)

UI cleanup:

- `src/app/admin/robot-intelligence/page.tsx`: `syncData` + `resetDatabase` neutralized (alerts explaining Firestore is the source of truth).

## Postgres surface after B-phase complete

Remaining `from '@/lib/db/postgres'` imports — all align with 4-table KEEP scope:

| File                                                                 | Table(s)                 |
| -------------------------------------------------------------------- | ------------------------ |
| `src/app/api/admin/training/route.ts`                                | training_videos          |
| `src/app/api/robot/v1/training/route.ts`                             | training_videos          |
| `src/app/api/robot/v1/feedback/route.ts`                             | robot_executions         |
| `src/app/api/admin/robot-intelligence/stats/route.ts`                | shifts, robot_executions |
| `src/app/api/robot-intelligence/route.ts`                            | robot_intelligence       |
| `src/lib/services/video-intelligence/processing-pipeline.service.ts` | training_videos          |
| `src/services/firebase-to-sql-sync.service.ts`                       | robot_intelligence       |

**Phase B.3 — api_keys, api_usage → Firestore (✅ done 2026-05-18):**

- New repo `src/lib/repositories/apiKeysFirestore.ts` (apiKeys + apiUsage)
- Rewrote `/api/admin/api-keys` (admin CRUD)
- Rewrote `/api/robot-intelligence` (Firestore auth + usage, Postgres `robot_intelligence` reads)
- Firestore rules: `apiKeys` / `apiUsage` → server-only (deny all client access)

**Phase B.4 — Robot v1 routes (✅ done 2026-05-18):**

- `/api/robot/v1/training` — already correct (Postgres `training_videos` = KEEP)
- `/api/robot/v1/feedback` — already correct (Postgres `robot_executions` = KEEP)
- `/api/robot/v1/address-intelligence` — already Firestore (no change)
- `/api/robot/v1/query` — **deleted**: 6-table JOIN against vanished schema; current Firestore docs lack the columns it queried (action_verb, sequence_order, human_verified, etc.). Rebuild later from current model if needed.

**Phase B.5 — Delete non-v1 robot routes (✅ done 2026-05-18):**

- `/api/robot/jobs/*` (incl. `[id]/videos`) — deleted
- `/api/robot/locations/*` (incl. `[id]/jobs`) — deleted
- `/api/robot/sessions` — deleted
- `/api/robot-intelligence` — kept (separate namespace, actively serves OEM partner API; migrated in B.3 to use Firestore apiKeys)

**Phase C — Bootstrap Drizzle baseline (4 hours):**

- Author `src/lib/db/schema.ts` for the 6 tables
- `drizzle-kit generate` → `0000_baseline.sql`
- Wire `pnpm db:migrate` into `deploy-staging.yml` (replace TODO stub)
- Apply to staging + prod

**Phase D — Cleanup (1 hour):**

- Update `CLAUDE.md`: dual-DB rule reflects new scope
- Delete `database/schema.sql`, `drizzle/legacy/*`
- Delete `scripts/run-schema.ts`

## Decisions (locked 2026-05-18)

1. **Robot routes**: tolerant of Firestore latency → **move all robot reads to Firestore**. No Postgres replicas of locations/jobs/tasks/media.
2. **Taxonomy lookup tables**: **Firestore collections** (admin-editable via UI).
3. **`/api/robot/*` (non-v1)**: replaced by `/api/robot/v1/*` → **delete as DEAD**.
4. **`api_keys` / `api_usage`**: **move to Firestore**. Accept ~45ms auth overhead per robot request.

## Final Postgres scope: 4 tables

```
training_videos      -- GIN array search, admin curation (admin UI)
robot_executions     -- append-only log from /api/robot/v1/feedback
shifts               -- robot session log
robot_intelligence   -- daily Firestore→Postgres sync target
```

Everything else: deleted from Postgres, moved to Firestore, or in-code constants.

## Revised route plan

**KEEP_POSTGRES (5 routes only):**

- `GET /api/admin/training`
- `PATCH /api/admin/training`
- `GET /api/admin/robot-intelligence/stats` (count aggregates over 4 PG tables)
- `GET /api/robot/v1/training`
- `POST /api/robot/v1/feedback`

**MIGRATE_TO_FIRESTORE (25 routes):**

- All 20 originally classified MIGRATE
- Plus `POST /api/robot/v1/query` (was KEEP, now move — robot routes Firestore'd)
- Plus `GET /api/robot/sessions` → reads `shifts`, which IS Postgres. Keep route on Postgres OR replicate shifts to Firestore. Decision: keep `shifts` Postgres-only, route stays KEEP.
- Plus robot v0 routes → DELETE (not migrate)

**DEAD (delete entirely):**

- `src/app/api/robot/jobs/route.ts`
- `src/app/api/robot/locations/route.ts`
- `src/app/api/robot/locations/[id]/route.ts`
- `src/app/api/robot/locations/[id]/jobs/route.ts`
- `src/app/api/robot/sessions/route.ts` ← KEEP if used; verify
- `src/app/api/admin/sync/all/route.ts`
- `src/app/api/admin/robot-intelligence/stats/route.ts.bak`
- `src/app/_archived/api/admin/cleanup-sql-orphans/route.ts`
- `src/lib/repositories/sql/locationPreferences.ts`
- `src/lib/repositories/sql/tasks.ts`
- `src/lib/services/sync/firestoreToSql.ts`
- `database/schema.sql`
- `scripts/run-schema.ts`
- `drizzle/legacy/` (entire dir)

`src/services/firebase-to-sql-sync.service.ts` shrinks to only sync `robot_intelligence` (keep, scope-reduce).
