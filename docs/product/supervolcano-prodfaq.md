# SuperVolcano TeleOps ProdFAQ

_Last updated: 2026-05-19_

_Merged from two sources: PB interactive sessions on 2026-04-23/24 (mobile camera, crash reporting, error handling, offline recording — all `CONFIRMED`) and a 2026-05-19 code audit covering project/data/auth/roles/locations/web/deploy (all `INFERRED`)._

_Walk the `INFERRED` items in priority order (BLOCKING first). Promote each to `CONFIRMED` once a PB attests to the answer._

---

## Project-Wide Questions

### Q-PROJ-001: Is the dual-DB split (Firestore for humans, Postgres for robots) the long-term architecture, or a transitional state?

**Scope:** Project-Wide
**Category:** BL / TA
**Priority:** BLOCKING
**Question:** CLAUDE.md states all human-facing endpoints use Firestore and only `/api/robot/v1/*` uses Postgres, with Postgres as a read-only replica synced daily. Phase B.2-tail just collapsed the Postgres surface to 4 tables (`training_videos`, `robot_executions`, `shifts`, `robot_intelligence`). Is Postgres a permanent fixture for the robot read-API, or is the eventual goal to migrate the remaining 4 tables to Firestore + BigQuery and retire Postgres entirely?
**Answer:** Permanent fixture for the robot-facing API. The 4 surviving tables are inherently robot-domain (training corpus + execution telemetry + intelligence index) and benefit from SQL-shaped queries + GIN indexes that Firestore can't match. Firestore remains the source of truth for human-facing entities (locations, tasks, users, orgs, sessions); Postgres is the read-optimised projection for robot consumers.
**Confidence:** INFERRED
**Source:** docs/postgres-audit.md final 4-table scope + CLAUDE.md L70-78 + inference

---

### Q-PROJ-002: Are there really two business models (B2B OEM robotics testing + B2C property management), or is one the strategic focus?

**Scope:** Project-Wide
**Category:** BL
**Priority:** BLOCKING
**Question:** The role enum, org-id prefix scheme (`oem:` vs `owner:`), and portal flows all assume two distinct revenue streams: paying OEM partners (Figure, Tesla, etc.) running teleoperated robots, and property owners hiring cleaners. Both share infrastructure but have disjoint user journeys. Is the company actually running both motions today, or is one the v1 and the other aspirational / on the back burner?
**Answer:** Both are real and in production, but they share substrate. The B2B side (OEM teleoperators) is the original product; B2C (property owners + cleaners) was layered on later to reuse the recording infrastructure. The two pipelines never cross — an OEM org and an owner org are walled off by `partnerOrgId` namespace.
**Confidence:** INFERRED
**Source:** src/types/organization.types.ts (OrganizationType enum) + role mapping + inference

---

### Q-PROJ-003: Is Identity Platform multi-tenancy a hard requirement, or could a single-tenant project have worked?

**Scope:** Project-Wide
**Category:** TA
**Priority:** CLARIFYING
**Question:** The GCP project uses Identity Platform with two tenants (`staging-ita88`, `prod-ftn50`). Multi-tenancy adds operational complexity (every admin Auth call must scope to tenant; users can't be listed at the project level; legacy `adminAuth.*` calls hit an empty pool). Was multi-tenancy chosen for env isolation (staging users can't sign into prod) or for a deeper reason (per-partner tenants in future)?
**Answer:** Chosen for env isolation in a single GCP project — one project hosts both staging and prod with namespaces. Per-partner tenants are not currently used. The tenant ID is essentially an env discriminator. If future per-partner isolation is needed, the model already supports it.
**Confidence:** INFERRED
**Source:** infra/terraform/identity_platform.tf + env_config map + inference

---

### Q-PROJ-004: Is mobile staying on the legacy Firebase project (`super-volcano-oem-portal`), or migrating to the new GCP project?

**Scope:** Project-Wide
**Category:** TA
**Priority:** BLOCKING
**Question:** CLAUDE.md says "the mobile app stays on legacy Firebase". But this session wired mobile to the new GCP staging tenant (config + EAS staging profile + tenant ID + named DB). What is the durable state — is mobile finishing its migration off legacy, or is the legacy project still the production target for mobile builds?
**Answer:** Mobile is migrating off legacy. The staging EAS profile + tenant + Cloud Run base URL added in this session represent the first real customer-facing wiring. The legacy `production` EAS profile is still on `super-volcano-oem-portal` and should be cut over once staging is verified end-to-end. CLAUDE.md is now stale on this point and should be updated.
**Confidence:** INFERRED
**Source:** mobile-app/eas.json (staging profile added this session) + CLAUDE.md L156-160 + inference

---

### Q-PROJ-005: Is `sv:internal` the single org for all admins, or one of many SuperVolcano-side orgs?

**Scope:** Project-Wide
**Category:** BL
**Priority:** CLARIFYING
**Question:** All admin/superadmin users are mapped to `sv:internal` (per `getOrganizationTypeForRole` and `OrganizationDropdown` auto-select). Will there ever be multiple SuperVolcano internal orgs (e.g., `sv:engineering`, `sv:operations`), or is `sv:internal` always the singleton?
**Answer:** Singleton. The "supervolcano" org type only ever has one member: `sv:internal`. Admins/superadmins all belong to it. The `sv:` prefix exists for symmetry with `oem:` and `owner:`, not for multi-tenancy on the SV side.
**Confidence:** INFERRED
**Source:** src/types/organization.types.ts + OrganizationDropdown.tsx L40 + inference

---

### Q-PROJ-006: Is the `partner_admin` role still in use, or a vestige?

**Scope:** Project-Wide
**Category:** BL
**Priority:** BLOCKING
**Question:** `partner_admin` appears in the UserRole union and is referenced by `requireRole` in 4+ endpoints (e.g., `/api/v1/locations` POST, `/api/v1/organizations` GET/POST), but has zero entries in the centralised `permissions.ts` map, and there's no script to create one. Is `partner_admin` a real role that someone holds, or dead code that should be removed?
**Answer:** Dead/legacy. CLAUDE.md only documents 6 roles and omits `partner_admin`. The endpoints that gate on it are pre-permissions-system code. Either `partner_admin` should be removed entirely (and its uses replaced with `partner_manager` or `superadmin`), or its semantics defined and added to the permissions map.
**Confidence:** INFERRED
**Source:** src/lib/auth/permissions.ts (no entries for partner_admin) + grep `requireRole(claims, "partner_admin")` + inference

---

### Q-PROJ-007: Is `org_manager` distinct from `partner_manager`, or the same role under two names?

**Scope:** Project-Wide
**Category:** BL
**Priority:** BLOCKING
**Question:** Both `partner_manager` and `org_manager` are defined in the UserRole union. There's a `scripts/create-org-manager.ts` script. CLAUDE.md describes the B2B partner-side manager role as "partner_manager". Are these two distinct roles (e.g., one is OEM-side, one is owner-side?) or duplicate names for the same role?
**Answer:** Duplicates with overlapping semantics, surviving from a rename that wasn't fully completed. `partner_manager` is the canonical name per CLAUDE.md; `org_manager` is the legacy name still referenced by the create-org-manager script + a handful of endpoints (e.g., `/api/v1/locations` GET allows both). Consolidate to `partner_manager` and remove `org_manager` from the enum.
**Confidence:** INFERRED
**Source:** UserRole union + scripts/create-org-manager.ts + grep `org_manager` vs `partner_manager` + inference

---

### Q-PROJ-008: Is the `member` role in mobile a real role, or a ghost?

**Scope:** Project-Wide
**Category:** BL
**Priority:** BLOCKING
**Question:** `mobile-app/src/services/auth.service.ts` allows sign-in for `['location_cleaner', 'oem_teleoperator', 'location_owner', 'member']` and `AppNavigator` has a dedicated branch for `member` that renders `MemberNavigator`. But `member` is not in the UserRole union, not in permissions.ts, not in any create script. Is this an aspirational role (e.g., individual contractors not tied to an org) or vestigial code?
**Answer:** Aspirational / half-built. Mobile is wired up to route `member` users into a different navigator stack (MemberHome, MemberRecord, GenericPendingUploads), suggesting a planned solo-contributor tier without an org. Web has not been extended to match. Either commit to building `member` end-to-end (add to UserRole, add permissions, add create flow) or rip out the mobile-only references.
**Confidence:** INFERRED
**Source:** auth.service.ts L50 + AppNavigator.tsx L42 + MemberNavigator + grep across web + inference

---

### Q-PROJ-009: Is the org-id prefix scheme (`sv:`, `oem:`, `owner:`) load-bearing, or just convention?

**Scope:** Project-Wide
**Category:** TA
**Priority:** CLARIFYING
**Question:** Org IDs follow the pattern `{prefix}:{slug}` and code parses the prefix in places (`parseOrganizationId`, dropdown auto-selection). Is the prefix machine-meaningful (used for routing decisions, security rules, etc.) or purely a human-readable convention enforced at creation?
**Answer:** Machine-meaningful but only weakly. The prefix encodes business-model type (B2B vs B2C vs SV-internal) and `getOrganizationTypeForRole` enforces role↔type compatibility. Firestore security rules don't appear to parse it directly. Renaming would require a data migration. Treat as load-bearing.
**Confidence:** INFERRED
**Source:** src/types/organization.types.ts + parseOrganizationId + inference

---

### Q-PROJ-010: Are CLAUDE.md and ARCHITECTURE.md still the authoritative product-intent docs, or is the code now ahead of them?

**Scope:** Project-Wide
**Category:** BL
**Priority:** CLARIFYING
**Question:** Several CLAUDE.md statements are demonstrably stale: "assignedTeleoperatorIds" (now org-level), 6 roles (code has 8), mobile on legacy Firebase (currently being cut over), neon/vercel mentions in prior versions. Is CLAUDE.md kept in sync with intent, or is the code itself the spec now?
**Answer:** Code is ahead. CLAUDE.md is updated periodically but not on every change. The truth is: code = current behavior, CLAUDE.md = approximate intent that drifts. Aspire to update CLAUDE.md whenever a documented section is altered, but expect drift between updates.
**Confidence:** INFERRED
**Source:** Audit diff vs CLAUDE.md + inference

---

### Q-MCR-013: Does crash reporting scope cover the web dashboard in v1?

**Scope:** Project-Wide
**Category:** TA, BL
**Priority:** CLARIFYING
**Question:** Does Production Readiness Report item #5 (no crash or error reporting) cover the web dashboard (`/src` Next.js) in the same pass, or is the v1 scope mobile-only?
**Answer:** Mobile-only in v1. Item #5 is placed inside Part 1 — Mobile App (Android) under P1. The dashboard equivalent is dashboard item #17 ("No system monitoring or performance dashboards"), tracked as a P3 observability gap in Part 2. Dashboard crash capture will require a separate tool evaluation (Sentry for Next.js SSR, Datadog RUM, or Vercel built-in observability) and different PII rules because the server-side dashboard handles more PII than the mobile app. Conflating them delays both. Deferred work: dashboard error/crash reporting is captured as a separate later ProdFAQ pass under a new topic (`Topic:Dashboard-Observability` or merged into dashboard item #17 resolution), tracking server-route exceptions, client-side React errors, API-route 5xx rate, Firestore/PG query failures, robot API auth anomalies. Not blocked by this rollout; can run in parallel under a different owner. Shared policy: PII/sanitized-error rules established in Q-MCR-004 + Q-MEH ruleset are the baseline for the future dashboard observability topic; do not re-litigate PII handling when that topic opens — point to Q-MCR-004.
**Confidence:** CONFIRMED
**Source:** `Supervolcano Production Readiness Report v2.md` item #5 placement; `CLAUDE.md` monorepo architecture; PB interactive session 2026-04-24 (accepted skill recommendation)

---

## Topic: Data Layer

### Q-DATA-001: Why does `/api/admin/training` (a human-facing route) read from Postgres if "human routes use Firestore"?

**Scope:** Topic:Data-Layer
**Category:** TA
**Priority:** CLARIFYING
**Question:** CLAUDE.md asserts "all human-facing endpoints" use Firestore. `/api/admin/training` GET reads `training_videos` from Postgres. Is this an intentional carve-out or a violation of the architecture rule?
**Answer:** Intentional carve-out. `training_videos` is the curated training corpus consumed by both admins (for review/labeling) and robots (for training pulls). Duplicating it into Firestore would lose GIN search + SQL-shape queries that the admin UI relies on. The architecture rule should be amended to: "human endpoints use Firestore for business entities; Postgres remains for analytical/ML resources shared with the robot API."
**Confidence:** INFERRED
**Source:** docs/postgres-audit.md + src/app/api/admin/training/route.ts + inference

---

### Q-DATA-002: Does `/api/admin/videos/approve-training` writing to Postgres violate the "never write to PostgreSQL from application code" rule?

**Scope:** Topic:Data-Layer
**Category:** TA / BL
**Priority:** BLOCKING
**Question:** CLAUDE.md says "Never write to PostgreSQL from application code". `/api/admin/videos/approve-training` calls `videoProcessingPipeline.syncToTrainingCorpus()` which `INSERT`s into `training_videos`. Is this acceptable (it's a one-way admin-curation write) or should it be refactored to flow through the cron sync?
**Answer:** Acceptable but should be documented as an exception. Admin training-corpus approval is a deliberate, audited write at human pace — not the same risk class as live application writes. Move the rule to: "no application writes to robot-facing Postgres tables except the curated approve-training admin flow and the cron Firestore→robot_intelligence sync."
**Confidence:** INFERRED
**Source:** src/services/video-intelligence/processing-pipeline.service.ts + CLAUDE.md L78 + inference

---

### Q-DATA-003: Is `/api/robot/v1/address-intelligence` reading Firestore (not Postgres) a bug or intentional?

**Scope:** Topic:Data-Layer
**Category:** TA
**Priority:** CLARIFYING
**Question:** CLAUDE.md says robot v1 endpoints use Postgres. `/api/robot/v1/address-intelligence` reads `locations` and `apiUsage` from Firestore. Should this be migrated to Postgres for consistency, or is Firestore the right home for this query?
**Answer:** Intentional — robot reads with Firestore-shaped data (address lookups against live `locations` collection) are fine. The "robot uses Postgres" rule applies to high-throughput training/feedback paths, not to occasional intelligence lookups. Document this exception in CLAUDE.md.
**Confidence:** INFERRED
**Source:** src/app/api/robot/v1/address-intelligence/route.ts + inference

---

### Q-DATA-004: Is `video_processing_queue` still active or should it be dropped?

**Scope:** Topic:Data-Layer
**Category:** TA
**Priority:** CLARIFYING
**Question:** `processing-pipeline.service.ts` references a `video_processing_queue` Postgres table, but it's not in the 4-table "keep" scope in `docs/postgres-audit.md`. Is the queue still in use, or is it a leftover that should be dropped?
**Answer:** Still in use as the working table for the approve-training flow. It should be added to the keep-scope list (so 5 tables, not 4) and the audit doc updated. If the goal is to drop it, the pipeline needs to be re-architected to use Cloud Tasks or Pub/Sub instead.
**Confidence:** INFERRED
**Source:** processing-pipeline.service.ts L54-491 + postgres-audit.md final scope + inference

---

### Q-DATA-005: Are the two task repositories (`tasks.ts` server, `tasksRepo.ts` client) intentional or a leftover?

**Scope:** Topic:Data-Layer
**Category:** TA
**Priority:** BLOCKING
**Question:** `src/lib/repositories/tasks.ts` (server, Admin SDK, subcollection pattern `/locations/{id}/tasks/{id}`) is the active task repo. `src/lib/repositories/tasksRepo.ts` (client, web SDK, flat `/tasks` collection) is never imported anywhere. Should `tasksRepo.ts` be deleted, or is it a planned client-side caching/optimistic-update layer?
**Answer:** Dead code. Delete `tasksRepo.ts`. The subcollection pattern in `tasks.ts` is the canonical model; the flat-collection alternative in `tasksRepo.ts` is from an earlier draft that was never adopted. Keeping both creates confusion about which is the truth.
**Confidence:** INFERRED
**Source:** grep "import.\*tasksRepo" returns no callers + inference

---

### Q-DATA-006: Is the daily cron sync still useful now that only `robot_intelligence` is synced?

**Scope:** Topic:Data-Layer
**Category:** TA
**Priority:** CLARIFYING
**Question:** Post-B.2-tail, `/api/cron/sync-sql` only syncs `robot_intelligence` (Firestore → Postgres). Is this sync valuable, or could `robot_intelligence` move to Firestore + a server-side query, dropping the cron entirely?
**Answer:** Resolved 2026-05-19 — removed entirely. The `robot_intelligence` table and its consuming `/api/robot-intelligence` endpoint were stale (target table never re-provisioned after the 2026-05 schema redesign). The training corpus uses `training_videos` (Postgres) and is written synchronously by `processing-pipeline.service.ts` during admin approval. No cron sync needed.
**Confidence:** CONFIRMED
**Source:** Cleanup commit 2026-05-19 (`page.tsx`, `cron/sync-sql`, `firebase-to-sql-sync.service`, `/api/robot-intelligence`, `scheduler.tf` all removed)

---

### Q-DATA-007: Should the Firestore named DB ID propagate via `NEXT_PUBLIC_FIRESTORE_DATABASE_ID` (build arg) or runtime env?

**Scope:** Topic:Data-Layer
**Category:** TA
**Priority:** CLARIFYING
**Question:** The server reads `FIRESTORE_DATABASE_ID` at runtime and the client reads `NEXT_PUBLIC_FIRESTORE_DATABASE_ID` inlined at build. This means client code must be rebuilt to change DBs. Is that acceptable, or should the client also read the value at runtime (e.g., via a `/api/config` endpoint)?
**Answer:** Build-time inlining is acceptable and matches the Cloud Run deployment model — env-specific images are pinned per-env anyway. The only failure mode is a wrong build arg in CI, which is caught by smoke testing immediately after deploy.
**Confidence:** INFERRED
**Source:** firebaseClient.ts L82-86 + deploy-staging.yml + inference

---

### Q-DATA-008: Does the location/task data model assume single-region Firestore, or is it ready for multi-region?

**Scope:** Topic:Data-Layer
**Category:** TA
**Priority:** CLARIFYING
**Question:** Both `staging-db` and `prod-db` are single-region named databases. Does the product expect to scale into multi-region or multi-DB partitioning later, or is single-region the durable target?
**Answer:** Single-region is the durable target for the foreseeable future. Multi-region adds cost without solving a current problem (latency from US-west to most users is fine). Revisit if international expansion happens.
**Confidence:** INFERRED
**Source:** infra/terraform/firestore.tf + inference

---

## Topic: Identity Platform & Tenants

### Q-AUTH-001: Why is the project-level user pool empty, and is that intentional?

**Scope:** Topic:Identity-Platform-Tenancy
**Category:** TA
**Priority:** BLOCKING
**Question:** With multi-tenancy enabled, every real user lives inside a tenant (`staging-ita88` or `prod-ftn50`). The project-level pool is supposed to stay empty. But `adminAuth.*` calls without tenant scoping silently target the project-level pool. Is "project pool empty" a deliberate constraint, and how is it enforced?
**Answer:** Deliberate constraint, not actively enforced. The expectation is that all user-creation paths scope to a tenant. Drift happens when an admin endpoint (`/api/admin/users/create` pre-fix, or any of the still-unfixed endpoints) calls `adminAuth.createUser` directly. Treat any project-level user as a bug. A future cleanup script should periodically nuke the project pool.
**Confidence:** INFERRED
**Source:** Bug discovered + fixed in this session at /api/admin/users/create + inference

---

### Q-AUTH-002: Are tenant IDs (`staging-ita88`, `prod-ftn50`) stable forever, or will they rotate?

**Scope:** Topic:Identity-Platform-Tenancy
**Category:** TA
**Priority:** BLOCKING
**Question:** Tenant IDs are hardcoded in seed scripts, mobile EAS profiles, and possibly other places. Are these IDs durable across the project's lifetime (terraform-managed and never replaced), or could they be rotated for any operational reason?
**Answer:** Stable forever for this project. Identity Platform tenant IDs are GCP-assigned at creation and cannot be changed; only the displayName can. Terraform should pin them. Any rotation would mean rebuilding the auth stack and migrating all users.
**Confidence:** INFERRED
**Source:** infra/terraform/identity_platform.tf + GCP Identity Platform docs + inference

---

### Q-AUTH-003: Should the admin endpoints that still use `adminAuth.*` directly be considered urgent bugs or backlog?

**Scope:** Topic:Identity-Platform-Tenancy
**Category:** TA
**Priority:** BLOCKING
**Question:** 6+ admin endpoints (`/api/admin/promote`, `/api/admin/users/[id]`, `/api/admin/users/[id]/sync`, `/api/admin/locations`, `/api/admin/contributions/export`, `lib/repositories/teleoperators.ts`) still use project-level `adminAuth.*` calls and will fail for tenant users. Is this a P0 sweep, or P1?
**Answer:** P0 for any endpoint that's used in current QA flows; P1 for the rest. The user-management endpoints (`[id]`, `sync`, `promote`) and `teleoperators.ts` are P0 because they break role assignment/promotion. `contributions/export` is P1 (analytics, less frequently used). Sweep before prod cutover.
**Confidence:** INFERRED
**Source:** Sweep needed per the spawned task earlier + inference

---

### Q-AUTH-004: Should mobile sign-in fall back to the project-level pool if `EXPO_PUBLIC_AUTH_TENANT_ID` is unset?

**Scope:** Topic:Identity-Platform-Tenancy
**Category:** TA / UX
**Priority:** CLARIFYING
**Question:** Current mobile config logs a warning and falls back to default-pool auth if `EXPO_PUBLIC_AUTH_TENANT_ID` is missing. Is this fallback a developer convenience worth keeping, or should it hard-fail to prevent silent prod misconfig?
**Answer:** Should hard-fail in any non-development build. The fallback is a footgun in production — a misconfigured build would silently sign users into the wrong pool. Change the warning to a thrown error when `__DEV__` is false.
**Confidence:** INFERRED
**Source:** mobile-app/src/config/firebase.ts L104-114 + inference

---

### Q-AUTH-005: What is the user-migration path when prod tenants are cut over?

**Scope:** Topic:Identity-Platform-Tenancy
**Category:** TA / BL
**Priority:** BLOCKING
**Question:** When mobile prod is cut over from `super-volcano-oem-portal` to `gen-lang-client-0659584673/prod-ftn50`, existing users in the legacy project need to be migrated. Identity Platform supports `gcloud identity-platform import` with hashed passwords. Is this the planned path, or will users be force-rotated (asked to reset password on next sign-in)?
**Answer:** Use `gcloud identity-platform import` with password-hash export so users don't notice the cutover. Force-rotation is unacceptable for active OEM teleoperators who'd lose access mid-shift. Schedule the import for a low-traffic window and provide a fallback support process for any failed imports.
**Confidence:** INFERRED
**Source:** Identity Platform docs + product reasoning + inference

---

### Q-AUTH-006: Should `seed-superadmin.ts`'s claim names (`organization_id` snake_case) be fixed to match camelCase?

**Scope:** Topic:Identity-Platform-Tenancy
**Category:** TA
**Priority:** BLOCKING
**Question:** `scripts/seed-superadmin.ts` writes claim `organization_id` (snake_case). `getUserClaims` reads `organizationId` (camelCase). The superadmin's org claim doesn't propagate. Is this a bug to fix immediately, or is the snake_case the right convention and the reader should be patched instead?
**Answer:** Fix the seed script to write camelCase (`organizationId`). camelCase is the convention used by every other write site (`promote`, `users/create`, `set-claims`, `teleoperators`). Snake_case is the outlier. Run a one-time migration to normalize any existing claims (currently only the staging superadmin) before swapping.
**Confidence:** INFERRED
**Source:** scripts/seed-superadmin.ts L65-68 vs auth.ts L30 + inference

---

### Q-AUTH-007: Should the centralised permissions map cover all roles, or only the non-bypass ones?

**Scope:** Topic:Identity-Platform-Tenancy
**Category:** TA
**Priority:** CLARIFYING
**Question:** `permissions.ts` has zero entries for `superadmin`, `partner_admin`, `org_manager`. `superadmin` is intentionally a bypass (`requireRole` short-circuits). But `partner_admin` and `org_manager` have no bypass and no permissions, making them functionally roleless. Add them to the map, or remove them from the enum?
**Answer:** Remove `partner_admin` from the enum entirely (it's dead, per Q-PROJ-006). For `org_manager`, consolidate into `partner_manager` (per Q-PROJ-007) and remove. For `superadmin`, document the bypass explicitly with a comment in `permissions.ts` so future readers don't assume it's an oversight.
**Confidence:** INFERRED
**Source:** permissions.ts + Q-PROJ-006/Q-PROJ-007 + inference

---

### Q-AUTH-008: When a dashboard create-user form is open, which tenant should new users land in?

**Scope:** Topic:Identity-Platform-Tenancy
**Category:** BL / UX
**Priority:** BLOCKING
**Question:** The current fix derives the target tenant from the caller's decoded token (`decodedToken.firebase.tenant`). This means an admin signed into staging creates users in staging. What if an admin signed into staging needed to provision a user into prod (e.g., onboarding)? Should there be a tenant-picker, or is "caller's tenant" the durable rule?
**Answer:** Caller's tenant is the durable rule. Cross-tenant user creation should never happen from the dashboard. If prod users need to be provisioned, that admin signs into the prod dashboard. This is consistent with the env-isolation model and prevents accidents.
**Confidence:** INFERRED
**Source:** Pattern from current fix + env-isolation design + inference

---

## Topic: Roles & Permissions

### Q-ROLE-001: Should the role enum be canonicalised to exactly the 6 roles CLAUDE.md documents?

**Scope:** Topic:Roles-Permissions
**Category:** BL
**Priority:** BLOCKING
**Question:** UserRole defines 8 roles (admin, superadmin, partner_admin, partner_manager, org_manager, location_owner, location_cleaner, oem_teleoperator). CLAUDE.md documents 6 (without partner_admin, org_manager). Should the code be cleaned to match CLAUDE.md (drop the two extra roles), or should CLAUDE.md be updated to describe what `partner_admin` and `org_manager` mean today?
**Answer:** Clean the code to match CLAUDE.md's 6-role model. Drop `partner_admin` (dead) and `org_manager` (consolidate into `partner_manager`). One concrete data migration: rewrite any existing `org_manager` users to `partner_manager` claims + Firestore docs. Out-of-scope claim/role names cause more bugs than they solve.
**Confidence:** INFERRED
**Source:** UserRole + CLAUDE.md L92-106 + Q-PROJ-006 + Q-PROJ-007 + inference

---

### Q-ROLE-002: Should `superadmin` have UI affordances for cross-org actions that no other role can do?

**Scope:** Topic:Roles-Permissions
**Category:** BL / UX
**Priority:** CLARIFYING
**Question:** `superadmin` is the bypass-everything role, but the admin portal doesn't have a clear "act as another org" toggle. Today, superadmin sees everything by default. Should there be an explicit org-impersonation flow (with audit log) or is global visibility the right default for SV-internal staff?
**Answer:** Global visibility is fine for now (small SV team, all internal). Add an audit log when superadmin mutates data on behalf of another org (already partially in place via `audit_logs` collection). Defer impersonation UI until SV grows or compliance demands it.
**Confidence:** INFERRED
**Source:** Admin portal pages + audit_logs writes in /api/admin/users/create + inference

---

### Q-ROLE-003: Should `location_owner` be able to delete their own locations, or only archive them?

**Scope:** Topic:Roles-Permissions
**Category:** BL
**Priority:** CLARIFYING
**Question:** `DELETE_LOCATIONS` permission is granted to `admin` and `location_owner` per `permissions.ts`. The repo soft-deletes by setting `status: "inactive"`. Should owners be able to truly remove locations + tasks + recordings, or only deactivate?
**Answer:** Soft-delete (deactivate) only. Hard-delete should be reserved for admins to handle accidental creates or GDPR-style erasure requests. Recordings have downstream value (training corpus) and shouldn't be deletable by owners.
**Confidence:** INFERRED
**Source:** locations.ts L167-172 (soft delete) + permissions.ts + inference

---

### Q-ROLE-004: Should `oem_teleoperator` and `location_cleaner` share the same mobile navigation, or diverge?

**Scope:** Topic:Roles-Permissions
**Category:** UX
**Priority:** CLARIFYING
**Question:** Both fall through to `CleanerNavigator` in the mobile `AppNavigator`. They share screens (Home, Record, Sessions). But the business contexts are very different (industrial robot teleop vs residential cleaning). Should there eventually be a `TeleopNavigator` separate from `CleanerNavigator`?
**Answer:** Diverge eventually but not yet. Today the workflows are mostly the same (sign in, pick task, record video, upload). Diverge when teleop-specific UX needs emerge (e.g., live tele-video stream, robot heartbeat, multi-camera control).
**Confidence:** INFERRED
**Source:** AppNavigator.tsx L46-50 (catch-all) + inference

---

### Q-ROLE-005: When a `partner_manager` invites a new teleoperator, should that user inherit the partner's `partnerId` automatically?

**Scope:** Topic:Roles-Permissions
**Category:** BL
**Priority:** CLARIFYING
**Question:** Teleoperator invite flows exist but it's unclear from code whether the invited user's claims auto-populate `partnerId` from the inviter, or whether the manager must pick. What's the design?
**Answer:** Inherit automatically from the inviter's `partnerId`. A partner_manager can only invite into their own partner — they have no UI to pick another. This both reduces error and reinforces the trust model. The current `teleoperators.ts` repo's `createTeleoperator` accepts `partnerOrgId` as a parameter; the calling endpoint should default it to `claims.partnerId`.
**Confidence:** INFERRED
**Source:** teleoperators.ts L48-67 + inference

---

## Topic: Locations & Tasks

### Q-LOC-001: Are locations always created via the wizard, or can they be created programmatically/bulk?

**Scope:** Topic:Locations-Tasks
**Category:** BL / UX
**Priority:** CLARIFYING
**Question:** The admin "new location" page is a 3-step wizard (basic info → builder → review). Are there other entry points — bulk CSV import, API for partners, mobile-initiated creates (owner)? If yes, are they consistent with the wizard's required fields?
**Answer:** Three entry points exist: (1) admin wizard (web), (2) `POST /api/v1/locations` (any partner_manager or superadmin via API token, used by external integrations or tests), (3) `AddLocationScreen` in mobile (location_owner). All three converge on the same `createLocation` repository call, so required fields are uniform. No bulk CSV importer today.
**Confidence:** INFERRED
**Source:** /api/v1/locations POST + mobile-app/.../AddLocationScreen.tsx + locations.ts createLocation + inference

---

### Q-LOC-002: Is the "Step 1 of 3" wizard label accurate?

**Scope:** Topic:Locations-Tasks
**Category:** UX
**Priority:** CLARIFYING
**Question:** `/admin/locations/new` shows "Step 1 of 3" with a progress bar implying 3 steps, but the page is actually just name + address entry. Steps 2 (Build Structure) and 3 (Review) happen on the location detail page via the `LocationWizard` component. Is the 3-step framing intentional UX or a labeling error?
**Answer:** Labeling error / aspirational UI. The wizard was designed as 3 steps but only step 1 was built as a standalone page; steps 2-3 are inlined into the location detail. Either commit to splitting the wizard into 3 routed pages or relabel as "Step 1 of 2 (basic info → builder)".
**Confidence:** INFERRED
**Source:** admin/locations/new/page.tsx L82-108 + admin/locations/[id]/page.tsx + inference

---

### Q-LOC-003: Are floors/rooms/targets first-class entities, or implied by task instructions?

**Scope:** Topic:Locations-Tasks
**Category:** BL / TA
**Priority:** BLOCKING
**Question:** Admin portal has pages for `floors/`, `rooms/`, `targets/` under `/admin/locations/[id]/`, suggesting a hierarchical model. But the repository layer only has tasks as a subcollection — no separate floors/rooms/targets collections. Are these UI-only concepts derived from task metadata (e.g., `room` field on instructions), or is there a hidden collection?
**Answer:** UI-only concepts derived from task instruction metadata. The data model is flat at the task level; `floor`, `room`, `target` are fields on instructions or tasks. The hierarchical pages reconstruct the tree from those fields. If a richer hierarchy is needed later, promote them to real collections.
**Confidence:** INFERRED
**Source:** repositories/tasks.ts + admin/locations/[id]/{floors,rooms,targets}/\* pages + inference

---

### Q-LOC-004: Is `assignedOrganizationId` the only assignment level, or should there be per-teleoperator assignment on the location?

**Scope:** Topic:Locations-Tasks
**Category:** BL
**Priority:** BLOCKING
**Question:** CLAUDE.md mentions `assignedTeleoperatorIds` (plural, per-location) but the actual schema only has `assignedOrganizationId` (singular). Tasks have `assignedTeleoperatorId` (singular). Is per-teleoperator location assignment planned, or has the model deliberately moved to org-level only?
**Answer:** Deliberately moved to org-level. Per-teleoperator location assignment was too rigid — orgs need to swap teleops freely. Tasks (not locations) carry the individual assignment when needed. CLAUDE.md is stale on this point and should be corrected.
**Confidence:** INFERRED
**Source:** locations.ts schema + tasks.ts assignedTeleoperatorId + CLAUDE.md L10 + inference

---

### Q-LOC-005: When a task is created, who assigns the teleoperator — the partner_manager manually, or auto-assignment by rule?

**Scope:** Topic:Locations-Tasks
**Category:** BL / UX
**Priority:** CLARIFYING
**Question:** `createTask` accepts `assignedTeleoperatorId` as input. Is the dashboard letting partner_managers pick manually, or is there an auto-assign rule (round-robin, availability-based)?
**Answer:** Manual today. Auto-assignment is a v2 feature — round-robin or availability-based picking would require teleop status tracking (currently rudimentary). Manual lets managers handle the political/skills nuances.
**Confidence:** INFERRED
**Source:** repositories/tasks.ts + inference

---

### Q-LOC-006: Are tasks meant to be one-off or recurring?

**Scope:** Topic:Locations-Tasks
**Category:** BL
**Priority:** CLARIFYING
**Question:** The task schema has `status`, `priority`, `estimatedDuration` but no recurrence/schedule field. Cleaning tasks naturally recur ("weekly bathroom clean"). Is recurrence on the roadmap or out of scope?
**Answer:** Out of scope for now; tasks are one-off. Recurrence is on the roadmap (cleaning use case demands it). When implemented, add a `recurrence` field with cron-like spec, and a job that materialises future task instances from a template.
**Confidence:** INFERRED
**Source:** tasks.ts schema + inference

---

### Q-LOC-007: How are stale tasks (assignment unclaimed for X days) handled?

**Scope:** Topic:Locations-Tasks
**Category:** BL / UX
**Priority:** CLARIFYING
**Question:** If a task is assigned but the teleop never picks it up, is there an SLA/expiry/reassignment? No such logic exists in the repo today.
**Answer:** No SLA/expiry today; tasks persist until completed or manually deleted. Add an `expiresAt` field + a daily cron that flips overdue tasks to `status: "expired"` once auto-assignment is in place. Today, the human partner_manager handles it.
**Confidence:** INFERRED
**Source:** tasks.ts (no expiry logic) + inference

---

## Topic: Mobile App

### Q-MOB-001: Is offline-recording-then-upload the durable design, or a workaround for shaky connectivity?

**Scope:** Topic:Mobile-App
**Category:** UX / TA
**Priority:** CLARIFYING
**Question:** Mobile records locally, queues uploads via AsyncStorage, and retries with exponential backoff [1s, 5s, 15s, 60s, 300s]. Background fetch polls every 15+ min. Is this the durable design (cleaners often work in basements / no signal) or a workaround?
**Answer:** Durable design. Field workers (both teleops at industrial sites and cleaners at residential properties) cannot rely on signal. The queue-first model is the right baseline. Iterations should focus on tighter retry windows + a clearer UX for "you have N unsent recordings".
**Confidence:** INFERRED
**Source:** upload-queue.service.ts + recording flow + inference

---

### Q-MOB-002: Are recordings uploaded directly to Firebase Storage or via Cloud Run, and does that match security expectations?

**Scope:** Topic:Mobile-App
**Category:** TA
**Priority:** BLOCKING
**Question:** Mobile uploads to Firebase Storage directly via the resumable upload protocol. Cloud Run is not in the upload path. Are Firebase Storage rules tight enough to prevent abuse (e.g., a stolen mobile token uploading 100GB of garbage)?
**Answer:** Direct-to-Storage is correct (Cloud Run shouldn't proxy multi-GB video uploads). Tighten Storage rules to: only authenticated users with `role IN allowed_roles` can write to specific path prefixes (`/recordings/{tenantId}/{uid}/...`), with a max-size constraint per file. The current rules need review — the firestore.rules path is hardened but storage.rules is less clear.
**Confidence:** INFERRED
**Source:** mobile-app/src/services/upload.ts + src/firebase/storage.rules + inference

---

### Q-MOB-003: What does the `member` role's mobile experience actually look like?

**Scope:** Topic:Mobile-App
**Category:** BL / UX
**Priority:** BLOCKING
**Question:** `MemberNavigator` has Home, Record, Sessions, Reward, Schedule, Settings, UploadQueue, FailedUploads, GenericPendingUploads, SessionComplete. This looks like a richer / gamified solo-contributor experience. Is the `member` role a planned consumer tier (e.g., gig workers earning rewards for recordings) or vestigial code?
**Answer:** Planned but unfinished. The presence of `Reward` and `GenericPendingUploads` (recordings not tied to a job) suggests a planned solo-contributor monetisation tier — individuals record street-level / store-level video for training data and earn rewards. Either ship it (add role to enum, add provisioning flow, market it) or delete the screens.
**Confidence:** INFERRED
**Source:** MemberNavigator + GenericPendingUploadsScreen + Reward + inference

---

### Q-MOB-004: Is the external USB camera (UVC) a required feature or an optional advanced mode?

**Scope:** Topic:Mobile-App
**Category:** UX / TA
**Priority:** CLARIFYING
**Question:** The external-camera native module is a large investment (custom Android module, dedicated UI in MemberRecordScreen). Is it required for the OEM teleop use case, or an optional power-user feature?
**Answer:** Required for the OEM teleop use case — teleoperators record using attached industrial cameras with higher resolution + wider FOV than phone cameras can deliver. For cleaners (B2C), the built-in camera is sufficient and external is invisible. The CameraModeToggle in MemberRecordScreen should probably be role-gated so cleaners never see it.
**Confidence:** INFERRED
**Source:** mobile-app/modules/external-camera + MemberRecordScreen + inference

---

### Q-MOB-005: What happens when an upload fails permanently — is there a path for the user to retry from the device?

**Scope:** Topic:Mobile-App
**Category:** UX
**Priority:** CLARIFYING
**Question:** Failed uploads land in a `FailedUploads` screen. Can the user manually retry, or is recovery admin-side only?
**Answer:** User can manually retry from `FailedUploadsScreen`. After max retries hit, the upload is paused (not deleted) and surfaced with a "tap to retry" button. Admin-side recovery (re-injecting from device storage to web) is not a current flow.
**Confidence:** INFERRED
**Source:** FailedUploads navigation route + upload-queue.service.ts retry policy + inference

---

### Q-MOB-006: Is `totalHoursUploaded` in `MemberRecordScreen` supposed to be real or hardcoded?

**Scope:** Topic:Mobile-App
**Category:** UX
**Priority:** CLARIFYING
**Question:** Line 198 hardcodes `totalHoursUploaded = 4.2` with a TODO. Is this a placeholder waiting for an aggregation query, or a vestigial counter that was never used and should be deleted?
**Answer:** Placeholder waiting for an aggregation query. The `Reward` screen and the cleaner home screen both want this metric. Implementation: Firestore query summing recording durations for the signed-in user, cached locally and refreshed on app open. Until then, either remove the number or label it "demo data".
**Confidence:** INFERRED
**Source:** MemberRecordScreen.tsx L198 (TODO comment) + inference

---

### Q-MOB-007: Should `/api/teleoperator/media/metadata` be wired up or deleted?

**Scope:** Topic:Mobile-App
**Category:** TA
**Priority:** CLARIFYING
**Question:** The endpoint exists on the web app but no mobile code calls it. Was metadata supposed to flow through it for indexing/search, or was it superseded by direct-to-Firestore writes from the upload completion handler?
**Answer:** Superseded. Metadata flows via the upload-queue service writing directly to Firestore on upload success. The route exists from an earlier design and should be deleted to avoid confusion.
**Confidence:** INFERRED
**Source:** Mobile codebase grep (no callers) + inference

---

## Topic: Mobile-Camera-Mode-Switch

### Q-MCMS-001: Allow camera mode switch during active recording?

**Scope:** Topic:Mobile-Camera-Mode-Switch
**Category:** BL, UX
**Priority:** BLOCKING
**Question:** Should the worker be allowed to switch camera mode (internal ↔ external) while actively recording?
**Answer:** Do not allow camera mode switching while recording is active in any flow — task-assigned (`MemberRecordScreen`) and generic/offline recording (UF:TBD-Offline-Recording-Mode). Mode switch controls must be disabled or hidden during recording. Worker must stop recording first before switching modes. See Q-MCMS-008 for cross-flow scope.
**Confidence:** CONFIRMED
**Source:** `Supervolcano Production Readiness Report v2.md` item #7; `mobile-app/src/screens/member/MemberRecordScreen.tsx :395–433`; PB interactive session 2026-04-23; scope clarified PB interactive session 2026-04-24 (accepted skill recommendation)
**History:**

- 2026-04-23 — Answer: "Do not allow camera mode switching while recording is active. Mode switch controls should be disabled or hidden during recording. Worker must stop recording first before switching modes." Confidence: CONFIRMED. Source: `Supervolcano Production Readiness Report v2.md` item #7; `mobile-app/src/screens/member/MemberRecordScreen.tsx :395–433`; PB interactive session 2026-04-23.

### Q-MCMS-002: Mode-switch failure timeout duration?

**Scope:** Topic:Mobile-Camera-Mode-Switch
**Category:** TA, UX
**Priority:** BLOCKING
**Question:** What timeout should apply before a mode-switch operation is considered failed?
**Answer:** 15 seconds. Matches existing camera connection timeout used elsewhere in the mobile app so workers learn a single consistent wait expectation for camera operations.
**Confidence:** CONFIRMED
**Source:** `mobile-app/App.tsx :13–14, 65–66`; `Supervolcano Production Readiness Report v2.md` item #3; PB interactive session 2026-04-23 (accepted skill recommendation)

### Q-MCMS-003: Worker-facing UI during mode-switch transition?

**Scope:** Topic:Mobile-Camera-Mode-Switch
**Category:** UX
**Priority:** BLOCKING
**Question:** What should the worker see while a mode-switch is transitioning from idle state?
**Answer:** Mode-switch only fires from idle state (no mid-recording switch). During the transition show a blocking overlay with the `Switching camera...` label already used in the record screen footer. Disable Record and Exit controls while the overlay is visible. After 5 seconds, reveal a Cancel action so the worker can escape if the camera is unresponsive. Do not show raw diagnostics on screen.
**Confidence:** CONFIRMED
**Source:** `mobile-app/src/screens/member/MemberRecordScreen.tsx :462–466`; Q-MEH-004 no-raw-errors rule; PB interactive session 2026-04-23 (accepted skill recommendation, refined after Q-MCMS-001)

### Q-MCMS-004: Behavior on 15-second mode-switch timeout?

**Scope:** Topic:Mobile-Camera-Mode-Switch
**Category:** UX, TA, BL
**Priority:** BLOCKING
**Question:** What should happen when a mode-switch hits the 15-second timeout without completing?
**Answer:** Automatically revert to the previous camera mode. Show a `Recording unavailable` friendly category message such as `Couldn't switch camera. Try again or check your camera connection.` Offer a `Try again` action. Keep raw error text in logs only; never surface it to the worker.
**Confidence:** CONFIRMED
**Source:** Q-MEH-002 scenario-mapped friendly messages; Q-MEH-007 controlled error categories; `mobile-app/src/hooks/useExternalCameraDiagnostics.ts` recovery pattern; PB interactive session 2026-04-23 (accepted skill recommendation)

### Q-MCMS-005: Cancel action during mode-switch transition?

**Scope:** Topic:Mobile-Camera-Mode-Switch
**Category:** UX, TA
**Priority:** BLOCKING
**Question:** Can the worker cancel a mode-switch mid-transition before the 15-second timeout expires?
**Answer:** Yes. A Cancel action appears in the transition overlay after 5 seconds (per Q-MCMS-003). On cancel, abort handling of the pending `setExternalModeEnabled` result, revert to the previous camera mode, and return the worker to the idle record screen. Prevents perceived freeze when the worker already knows the camera is off or unavailable.
**Confidence:** CONFIRMED
**Source:** `mobile-app/src/screens/member/MemberRecordScreen.tsx :395–433`; Q-MCMS-003; PB interactive session 2026-04-23 (accepted skill recommendation)

### Q-MCMS-006: Target-mode camera initialization failure behavior?

**Scope:** Topic:Mobile-Camera-Mode-Switch
**Category:** TA, UX, BL
**Priority:** BLOCKING
**Question:** If the target mode's camera fails to initialize after a mode-switch (for example external camera unplugged mid-transition, permission denied, or native module error), what should the app do?
**Answer:** Automatically revert to the previous camera mode. Show a `Recording unavailable` friendly message tailored to the cause category (`External camera disconnected`, `Camera permission needed`, `Camera couldn't start`). Keep the worker on the record screen in the working mode. Do not strand the worker in a broken target mode.
**Confidence:** CONFIRMED
**Source:** Q-MEH-007 controlled categories; Q-MEH-002 scenario-mapped messages; `Supervolcano Production Readiness Report v2.md` item #2 camera-disconnect cleanup; PB interactive session 2026-04-23 (accepted skill recommendation)

### Q-MCMS-007: Retry action after mode-switch failure?

**Scope:** Topic:Mobile-Camera-Mode-Switch
**Category:** UX, BL
**Priority:** BLOCKING
**Question:** After a mode-switch failure or timeout, should the worker get a retry action in the failure message, or must they close and reopen the record screen to try again?
**Answer:** Expose a `Try again` action directly in the failure message so the mode-switch can be re-invoked without leaving the record screen. Aligns with the broader recovery-not-reconstruct pattern already established for upload retries; the worker should not have to unwind the flow to recover.
**Confidence:** CONFIRMED
**Source:** Q-MEH-006 retry pattern; Q-MCMS-004; PB interactive session 2026-04-23 (accepted skill recommendation)

### Q-MCMS-008: Does mode-switch prohibition cover generic/offline recordings too?

**Scope:** Topic:Mobile-Camera-Mode-Switch
**Category:** BL, UX
**Priority:** BLOCKING
**Question:** Does the rule blocking camera mode switching during active recording apply to generic/offline recordings (UF:TBD-Offline-Recording-Mode), or only to task-assigned recordings in `MemberRecordScreen`?
**Answer:** Apply universally. Mode-switch controls are disabled or hidden whenever recording is active, regardless of whether the session originated from an assigned task or from the generic/offline recording flow. Worker must stop recording before switching modes in both paths. All mode-switch lifecycle rules (15s timeout, `Switching camera...` blocking overlay, 5s Cancel reveal, auto-revert on failure, friendly error categories, `Try again` action) apply identically in both flows.
**Confidence:** CONFIRMED
**Source:** Q-MCMS-001..007 existing ruleset + Q-UFTBD-001 (generic recording first-class from home); PB interactive session 2026-04-24 (accepted skill recommendation)

---

## Topic: Mobile-Crash-Reporting

### Q-MCR-001: Crash/error reporting provider choice?

**Scope:** Topic:Mobile-Crash-Reporting
**Category:** TA
**Priority:** BLOCKING
**Question:** Which crash/error reporting provider should the mobile app integrate — Firebase Crashlytics, Sentry, or another tool?
**Answer:** Firebase Crashlytics. Project already runs on Firebase (Auth, Firestore, Storage, Functions) per `CLAUDE.md`. Crashlytics adds no new vendor, no new billing surface, reuses Firebase Auth UID for anonymized user identity, and has mature Expo dev-client integration via `@react-native-firebase/crashlytics`. Sentry offers richer UX (session replay, performance, release health) but introduces a new SaaS vendor, new auth, new cost center, and new SDK surface. Defer Sentry to a later evaluation if Crashlytics limits surface.
**Confidence:** CONFIRMED
**Source:** `Supervolcano Production Readiness Report v2.md` mobile P1 #5; `CLAUDE.md` Firebase stack; PB interactive session 2026-04-24 (accepted skill recommendation)

### Q-MCR-002: What error types must the crash reporter capture?

**Scope:** Topic:Mobile-Crash-Reporting
**Category:** TA
**Priority:** BLOCKING
**Question:** What error types must the mobile crash reporter capture?
**Answer:** Capture four classes: (1) Fatal native crashes — JVM exceptions + NDK/native crashes (Crashlytics Android SDK default). (2) Unhandled JS exceptions — React error boundary catches (Q-MCR-011) + global unhandled promise rejections via `ErrorUtils.setGlobalHandler` + `unhandledrejection`. (3) ANRs — captured automatically by the Crashlytics native layer. (4) Non-fatal recorded errors via the central `logError` helper (Q-MCR-012) at known error sites: upload retries exhausted, mode-switch timeout (Q-MCMS-004), mode-switch target-init failure (Q-MCMS-006), external camera native module errors, permission-denial aborts. Do NOT record user-canceled actions, expected validation failures, or routine network-offline states.
**Confidence:** CONFIRMED
**Source:** Crashlytics SDK default coverage; Q-MCMS-004, Q-MCMS-006, Q-MEH ruleset; PB interactive session 2026-04-24 (accepted skill recommendation)

### Q-MCR-003: Any user-facing crash-reporting UI?

**Scope:** Topic:Mobile-Crash-Reporting
**Category:** UX, BL
**Priority:** BLOCKING
**Question:** Should any crash-reporting UI be visible to end users (opt-in prompt, "send report" dialog, crash-detail screen, "report this error" button)?
**Answer:** No user-facing crash-reporting UI. Reporting is fully silent and automatic. The global fatal error boundary fires `recordError` silently, then renders the Q-MEH-001 fallback unchanged ("Something went wrong. Please close and reopen…"). No dialog, no toast, no badge, no opt-in prompt, no "send report" button. Consent is covered externally (Q-MCR-010).
**Confidence:** CONFIRMED
**Source:** Q-MEH-001, Q-MEH-004, Q-MEH-009; PB interactive session 2026-04-24 (accepted skill recommendation)

### Q-MCR-004: PII handling in crash reports?

**Scope:** Topic:Mobile-Crash-Reporting
**Category:** BL, TA
**Priority:** BLOCKING
**Question:** How should PII be handled in crash reports — user identifiers, breadcrumbs, custom keys, error messages?
**Answer:** Strict PII-minimization. User identity: only `crashlytics().setUserId(firebaseAuthUid)` — anonymous stable ID, no email/name/phone/org slug/location ID. Custom keys allowed: app version, build number, release channel (staging/prod), camera mode (`native`/`external`), external camera connection phase, session state flag (`recording`/`idle`), role, network state. Custom keys forbidden: email, display name, location name, task title, address, device owner name, file paths containing user content, any user-entered free-text. Breadcrumbs: navigation screen names, camera lifecycle events, upload queue state transitions, connectivity changes only; use internal IDs, never user-visible labels. Error messages: raw exception `.message` passed through for SDK-originated errors; for custom `recordError` via `logError` helper (Q-MCR-012), strip user-data substrings before recording. Device metadata: Crashlytics default OK; do not add GPS/IP/cell-tower data. Enforcement centralized in a thin wrapper around `@react-native-firebase/crashlytics` so all call sites go through the sanitizer.
**Confidence:** CONFIRMED
**Source:** Q-MEH-004 no-raw-errors; dashboard P1 #5 PII-hashing mandate; Crashlytics hygiene best practice; PB interactive session 2026-04-24 (accepted skill recommendation)

### Q-MCR-005: Offline crash delivery?

**Scope:** Topic:Mobile-Crash-Reporting
**Category:** TA
**Priority:** CLARIFYING
**Question:** How should crashes that happen while the device is offline be delivered — rely on SDK defaults, or build a custom queue?
**Answer:** Rely on the Crashlytics native offline queue. The SDK persists unsent reports to disk and ships them on next app launch with connectivity. No custom retry or queue logic. Field workers operate offline frequently (per UF:TBD-Offline-Recording-Mode); the native queue handles this without extra code surface. Verify retention window during smoke testing and accept it as a v1 limitation if reports older than N days are dropped. Do not build a parallel queue.
**Confidence:** CONFIRMED
**Source:** Crashlytics SDK default behavior; Q-UFTBD-001..014 offline-first context; PB interactive session 2026-04-24 (accepted skill recommendation)

### Q-MCR-006: Release tracking and symbolication configuration?

**Scope:** Topic:Mobile-Crash-Reporting
**Category:** TA
**Priority:** BLOCKING
**Question:** How should release tracking and symbolication be configured so crash reports are actually readable?
**Answer:** Three-layer symbolication wired into the EAS build pipeline. (1) Android native symbols — enable Crashlytics NDK if native C/C++ ever ships; upload `libs.so` debug symbols via `firebase crashlytics:symbols:upload` in an EAS post-build hook. (2) ProGuard/R8 mappings — Crashlytics Gradle plugin auto-uploads `mapping.txt` on release builds when `firebaseCrashlytics.mappingFileUploadEnabled = true`; ensure enabled for the release variant. (3) Hermes source maps — Hermes bytecode requires uploading `.bundle.map` + `.hbc.map` via Crashlytics REST API in an EAS post-build hook (expo-firebase does not handle this automatically). Without this, JS stack traces are unreadable. Release identity: `versionName` + `versionCode` in `build.gradle` must bump per EAS build (automate via `eas.json` auto-increment); `app.json` `expo.version` mirrors `versionName`; register each EAS build as a Crashlytics release via CI so crashes group per release. CI placement: new script in EAS `postPublish` hook or GitHub Action runs symbolication upload after every `eas:build:android`. Block `eas:update` OTA publishes from bumping native version (OTA reuses existing Crashlytics release).
**Confidence:** CONFIRMED
**Source:** Crashlytics symbolication docs; `mobile-app/package.json` EAS script inventory; Hermes default in Expo SDK 50+; PB interactive session 2026-04-24 (accepted skill recommendation)

### Q-MCR-007: Staging vs production environment separation?

**Scope:** Topic:Mobile-Crash-Reporting
**Category:** TA
**Priority:** BLOCKING
**Question:** How should crash reports be separated between staging and production environments?
**Answer:** Separate Firebase projects for staging vs production. Crashlytics is scoped per Firebase project — staging crashes land in the staging project's Crashlytics dashboard, prod crashes land in prod. Zero cross-contamination risk, no custom tagging needed. Implementation: two `google-services.json` files selected by EAS build profile (`preview` → staging project, `production` → prod project); `mobile-app/src/config/firebase.ts` pointed at the env-appropriate config at build time; release channel custom key (`staging`/`production`) additionally set on Crashlytics for instant dashboard filtering; alert routing (Q-MCR-008) configured per project so staging noise does not reach prod alert channels. Aligns with the April 13 meeting action item for Aulia: create separate staging and production environments and configure GitHub branches to deploy to the correct environment.
**Confidence:** CONFIRMED
**Source:** `Supervolcano Production Readiness Report v2.md` Next Steps (April 13 meeting); `CLAUDE.md` Firebase config pattern; Crashlytics per-project scope; PB interactive session 2026-04-24 (accepted skill recommendation)

### Q-MCR-008: Crash alert routing and thresholds?

**Scope:** Topic:Mobile-Crash-Reporting
**Category:** TA
**Priority:** CLARIFYING
**Question:** Where should crash alerts route — email, Slack, PagerDuty, elsewhere — and at what thresholds?
**Answer:** Slack alerts via Firebase Crashlytics native Slack integration. Two alert rules: (1) New fatal crash — Crashlytics "new issue" alert → Slack channel on any never-before-seen fatal. (2) Velocity alert — Crashlytics velocity alert → Slack when a crash affects >1% of sessions within a rolling window. Routing: prod crashes → prod engineering Slack channel (name TBD by PB — suggest `#supervolcano-alerts-prod`); staging crashes → lower-priority channel or same channel with `[staging]` prefix (suggest separate `#supervolcano-alerts-staging` to reduce noise). Configure via Firebase Console → Project Settings → Integrations → Slack (native Crashlytics Slack app), one integration per Firebase project. Not in v1: email alerts, PagerDuty on-call rotation. Revisit when team grows or 24/7 on-call exists.
**Confidence:** CONFIRMED
**Source:** Crashlytics alert primitives; team size inferred from recent commits; PB interactive session 2026-04-24 (PB override — chose Slack instead of recommended email)

### Q-MCR-009: Breadcrumb strategy?

**Scope:** Topic:Mobile-Crash-Reporting
**Category:** TA
**Priority:** CLARIFYING
**Question:** What breadcrumb strategy should the app use — what events to log, what to exclude, how much context per breadcrumb?
**Answer:** Log non-PII breadcrumbs at five event categories via `crashlytics().log(message)`. (1) Navigation — screen name on every focus change (`nav: enter MemberRecordScreen`, `nav: leave GenericRecordingHubScreen`); screen names only, never route params. (2) Camera lifecycle — `camera: connect external`, `camera: disconnect external`, `camera: mode-switch native→external`, `camera: mode-switch timeout`, `camera: mode-switch canceled`, `camera: preview ready`. (3) Recording lifecycle — `rec: session start assigned`, `rec: session start generic`, `rec: segment finalized N`, `rec: session stop`; no location ID or task title. (4) Upload queue — `upload: queued`, `upload: started`, `upload: retry N`, `upload: failed-permanent`, `upload: success`; no file paths or user identifiers. (5) Network — `net: online`, `net: offline`. Forbid: location names, task titles, addresses, worker-entered free-text, file paths with user content, Firestore document IDs that encode org/location, full URLs with query strings. Retention: rely on Crashlytics default (last 100 log entries per session); do not increase. Centralization: single `logBreadcrumb(category, event)` helper wraps `crashlytics().log()` so format is consistent and PII filters run in one place.
**Confidence:** CONFIRMED
**Source:** Crashlytics breadcrumb primitives; Q-MCR-004 PII policy; existing mobile app event taxonomy; PB interactive session 2026-04-24 (accepted skill recommendation)

### Q-MCR-010: Opt-in vs default-on crash reporting?

**Scope:** Topic:Mobile-Crash-Reporting
**Category:** BL
**Priority:** BLOCKING
**Question:** Should crash reporting require explicit user opt-in, or be enabled by default for all authenticated workers?
**Answer:** Enabled by default for all authenticated users. No in-app opt-in prompt, no toggle in settings for v1. Rationale: (1) Employment context dominates — both B2B (`oem_teleoperator`) and B2C (`location_cleaner`, `location_owner`) roles operate employer-authorized phones or fulfill commercial contracts; crash telemetry is a standard operational requirement. (2) Consent covered externally via terms of service, employment agreements, partner contracts — no product UI duplicates that. (3) Consistent with Q-MEH-001/004 — end users see zero error-handling chrome; an opt-in prompt would be the one exception, contradicting the sanitized UX decision. (4) `setCrashlyticsCollectionEnabled(true)` hard-wired on startup; do not gate on a user preference. Revisit triggers: regulatory requirement (GDPR worker consent, regional privacy law) requiring explicit opt-in — revisit before EU/UK expansion; consumer-grade B2C expansion where workers are independent contractors bringing their own devices — revisit then. Document the default-on decision in product policy so legal/compliance has a record.
**Confidence:** CONFIRMED
**Source:** `CLAUDE.md` role model; Q-MEH-001, Q-MEH-004; Crashlytics collection flag semantics; PB interactive session 2026-04-24 (accepted skill recommendation)

### Q-MCR-011: React error boundary + Crashlytics integration?

**Scope:** Topic:Mobile-Crash-Reporting
**Category:** TA, UX
**Priority:** BLOCKING
**Question:** How should the React global error boundary integrate with Crashlytics so fatal JS errors are both reported and surface the Q-MEH-001 friendly fallback?
**Answer:** Wire Crashlytics into the existing global error boundary at `mobile-app/App.tsx :32–35` (per Production Readiness Report item #4 and Q-MEH-001). (1) `componentDidCatch(error, info)` — `crashlytics().recordError(error)` for full stack; `crashlytics().log('boundary: caught fatal')` breadcrumb; `crashlytics().setAttribute('boundary_component_stack_truncated', info.componentStack?.split('\n').slice(0, 20).join('\n') ?? '')` — bounded slice so large component trees do not blow report size; render the Q-MEH-001 fallback unchanged. (2) Global unhandled JS errors (outside React tree) in `App.tsx` startup — `ErrorUtils.setGlobalHandler((error, isFatal) => { crashlytics().recordError(error); defaultHandler(error, isFatal); })` preserving RN default behavior. (3) Unhandled promise rejections — enable `promise/setimmediate/rejection-tracking` (or equivalent); on `unhandled` → `crashlytics().recordError(reason)`. (4) Initialization order — initialize Crashlytics before rendering the navigator; `setUserId(firebaseAuthUid)` on auth change inside `AuthContext` (`mobile-app/src/contexts/AuthContext.tsx`); clear on sign-out with `setUserId('')`. (5) Non-fatal vs fatal — error boundary reports as non-fatal (`recordError`) since JS threw but the app survived with fallback UI; native crashes already fatal; velocity alerts (Q-MCR-008) must fire on non-fatals too. (6) No user-facing change — fallback copy, layout, and behavior from Q-MEH-001/Q-MEH-009 remain byte-identical.
**Confidence:** CONFIRMED
**Source:** `mobile-app/App.tsx :32–35` (Production Readiness Report item #4); Q-MEH-001, Q-MEH-009; `@react-native-firebase/crashlytics` API; RN `ErrorUtils` pattern; PB interactive session 2026-04-24 (accepted skill recommendation)

### Q-MCR-012: Centralized `logError` helper — location, signature, call sites?

**Scope:** Topic:Mobile-Crash-Reporting
**Category:** TA
**Priority:** CLARIFYING
**Question:** Where should a centralized `logError` helper live, what is its signature, and which call sites must adopt it in v1?
**Answer:** Create `mobile-app/src/utils/logError.ts` exporting a single helper; all non-fatal error reporting flows through it.

Signature:

```ts
type LogErrorContext = {
  category:
    | "upload"
    | "camera"
    | "mode-switch"
    | "permission"
    | "recording"
    | "auth"
    | "network";
  action?: string;
  metadata?: Record<string, string | number | boolean>;
};

export function logError(error: unknown, context: LogErrorContext): void;
```

Behavior: (1) Normalize `error` to `Error` — wrap strings/unknowns in `new Error(String(error))`. (2) Strip PII from `metadata` via a small allowlist (per Q-MCR-004 custom-keys allow list); reject keys not on the allowlist with a dev-only warning. (3) `crashlytics().setAttribute('last_error_category', context.category)` + `setAttribute('last_error_action', context.action ?? '')`. (4) For each metadata entry, `crashlytics().setAttribute(key, String(value))` only if the key is on the allowlist. (5) `crashlytics().log(\`err: ${context.category}/${context.action ?? 'n/a'}\`)`breadcrumb. (6)`crashlytics().recordError(normalizedError)`. (7) In `**DEV**`, also `console.warn('[logError]', context, error)` for local visibility; in production builds, no console output — stays silent per Q-MEH-004.

v1 mandatory call sites:

- `mobile-app/src/services/upload-queue.service.ts` — retries exhausted, permanent failure.
- `mobile-app/src/screens/member/MemberRecordScreen.tsx` — mode-switch timeout (Q-MCMS-004), mode-switch catch blocks (Q-MCMS-006).
- `mobile-app/src/screens/CameraScreen.tsx` — same mode-switch paths (added per Q-MCMS-008).
- `mobile-app/src/hooks/useExternalCameraDiagnostics.ts` — external camera init failure, connection-timeout path.
- `mobile-app/src/native/external-camera.ts` — native module call failures that currently `console.warn`.
- `mobile-app/src/contexts/AuthContext.tsx` — auth-load failures, sign-in unexpected errors (not credential errors, which are expected).

Replace existing `console.warn`/`console.error` in the listed files with `logError`; keep `console.log` only when guarded by `__DEV__` or for dev-only paths. Do NOT adopt for: expected validation errors, user-cancel actions, network-offline states, Firestore permission-denied on read during logout.
**Confidence:** CONFIRMED
**Source:** Q-MCR-002, Q-MCR-004; Q-MEH-004; current mobile error-site inventory; PB interactive session 2026-04-24 (accepted skill recommendation)

---

## Topic: Mobile-Error-Handling

### Q-MEH-001: What should the global fatal error screen show?

**Scope:** Topic:Mobile-Error-Handling
**Category:** UX, TA
**Priority:** BLOCKING
**Question:** In production, should the app use a single generic user-facing message for uncaught fatal errors in the global error boundary, or should it show different friendly messages depending on the failure type?
**Answer:** Use a single generic production message for uncaught fatal errors in the global error boundary. Keep the message calm and non-technical, for example: “Something went wrong. Please close and reopen the app. If the problem continues, contact support.” Do not expose raw exception messages, stack traces, or error object strings on screen. Preserve detailed diagnostics only in logs.
**Confidence:** CONFIRMED
**Source:** `Supervolcano Production Readiness Report v2.md` item `#4`; `mobile-app/App.tsx`; PB interactive session 2026-04-23 (accepted skill recommendation)

### Q-MEH-002: How should recoverable errors be surfaced?

**Scope:** Topic:Mobile-Error-Handling
**Category:** UX, TA
**Priority:** BLOCKING
**Question:** For recoverable errors in user flows such as login, recording, queueing, upload, and task loading, should the app map technical failures to a fixed set of friendly product messages, or should it still surface backend-provided text when it seems understandable?
**Answer:** Map recoverable errors to a controlled set of friendly product messages by scenario, not raw backend text. Backend and runtime error text should stay in logs only, even when the text seems understandable. As part of this work, add a screen for failed uploaded videos so workers can see upload failures in a dedicated place.
**Confidence:** CONFIRMED
**Source:** `Supervolcano Production Readiness Report v2.md` item `#4`; mobile alert and upload flow inspection; PB interactive session 2026-04-23

### Q-MEH-003: What must the failed-uploaded-videos screen support?

**Scope:** Topic:Mobile-Error-Handling
**Category:** UX, TA
**Priority:** BLOCKING
**Question:** What exact behavior should the new failed-uploaded-videos screen support: view-only visibility, retry actions, delete actions, or additional diagnostics for support?
**Answer:** The failed-uploaded-videos screen should show a concise list of failed items with worker-safe labels and timestamps, allow retry for each item, allow retry all failed items, and allow delete for items the worker chooses to discard. Do not show raw technical diagnostics by default; keep support details internal to logs rather than on the worker-facing screen.
**Confidence:** CONFIRMED
**Source:** mobile upload queue inspection; PB interactive session 2026-04-23

### Q-MEH-004: Can any production user role see raw errors?

**Scope:** Topic:Mobile-Error-Handling
**Category:** BL, UX, TA
**Priority:** BLOCKING
**Question:** Should raw technical error details ever be shown inside the production mobile app to any end-user role, or must all production roles receive only sanitized product messages?
**Answer:** All production mobile roles should receive only sanitized product messages. No end-user role should see raw exception text, stack traces, backend responses, or internal identifiers inside the production app. If engineering needs richer diagnostics, expose them only through logs or a developer-only path outside the normal production worker UI.
**Confidence:** CONFIRMED
**Source:** `Supervolcano Production Readiness Report v2.md` item `#4`; PB interactive session 2026-04-23 (accepted skill recommendation)

### Q-MEH-005: How should upload failures be surfaced immediately?

**Scope:** Topic:Mobile-Error-Handling
**Category:** UX, TA
**Priority:** BLOCKING
**Question:** When a recoverable upload failure happens, should the worker get an immediate inline notification plus the failed-upload screen entry, or should the system silently place the item in the failed list and rely on the worker discovering it later?
**Answer:** Show an immediate friendly notification when an upload fails, and also place the item in the failed-uploaded-videos screen for later action. The notification should say what happened in user-safe terms and point the worker to the failed uploads area, without exposing technical details.
**Confidence:** CONFIRMED
**Source:** mobile upload queue inspection; PB interactive session 2026-04-23 (accepted skill recommendation)

### Q-MEH-006: What should retry do from the failed uploads screen?

**Scope:** Topic:Mobile-Error-Handling
**Category:** UX, BL, TA
**Priority:** BLOCKING
**Question:** What should happen after the worker taps retry on a failed upload: should the app retry immediately in place, move the item back into the normal upload queue, or require the worker to reopen the original recording flow?
**Answer:** Retry should immediately move the item back into the normal upload queue from the failed-uploaded-videos screen. Do not require the worker to reopen the original recording flow or re-enter metadata unless the item is invalid. The failed screen is for recovery, not for reconstructing the workflow.
**Confidence:** CONFIRMED
**Source:** mobile upload queue inspection; PB interactive session 2026-04-23 (accepted skill recommendation)

### Q-MEH-007: Which user-facing error categories are allowed?

**Scope:** Topic:Mobile-Error-Handling
**Category:** UX, TA
**Priority:** BLOCKING
**Question:** Should the app distinguish between different friendly error categories in user-facing copy, for example `No internet`, `Upload failed`, `Permission needed`, and `Temporary problem`, or do you want one generic non-technical message for all recoverable failures too?
**Answer:** Use a small controlled set of friendly categories for recoverable errors, not one message for everything. At minimum: `No internet`, `Upload failed`, `Permission needed`, `Recording unavailable`, and `Something went wrong`. Keep the wording user-safe and action-oriented, and keep the mapping centralized so raw messages never leak through.
**Confidence:** CONFIRMED
**Source:** mobile alert inspection; PB interactive session 2026-04-23 (accepted skill recommendation)

### Q-MEH-008: When should the failed uploads entry point appear?

**Scope:** Topic:Mobile-Error-Handling
**Category:** UX
**Priority:** CLARIFYING
**Question:** Should the failed-uploaded-videos screen be reachable only from upload-failure notifications and queue badges, or should it also have a permanent navigation entry on the logged-in home screen?
**Answer:** Surface the failed-uploaded-videos entry point when failures exist. Do not keep it as a permanent home-screen navigation item when there are no failed uploads.
**Confidence:** CONFIRMED
**Source:** PB interactive session 2026-04-23

### Q-MEH-009: Should the fatal error screen offer in-app retry?

**Scope:** Topic:Mobile-Error-Handling
**Category:** UX
**Priority:** CLARIFYING
**Question:** On the global fatal error screen for uncaught app crashes, should the UI only show friendly guidance to close and reopen the app, or should it also include an in-app recovery action such as `Try again`?
**Answer:** In v1, show friendly guidance to close and reopen the app rather than a `Try again` action. For uncaught fatal errors, an in-app retry path may return the worker to an unstable state. Keep the screen simple, calm, and non-technical.
**Confidence:** CONFIRMED
**Source:** `mobile-app/App.tsx`; PB interactive session 2026-04-23 (accepted skill recommendation)

---

## Topic: Web Portals

### Q-PORT-001: Is the `/admin` portal accessed only by SV-internal staff?

**Scope:** Topic:Web-Portals
**Category:** UX / BL
**Priority:** CLARIFYING
**Question:** `/admin` is gated by `admin`/`superadmin` roles. No partner-side user ever sees it. Is this strict, or could a future feature (e.g., partner admins managing their own teleops) move some `/admin` pages into `/org`?
**Answer:** Strict today, but with planned migrations. Some admin functionality (managing your own teleops, viewing your org's sessions) belongs in `/org`. The split is mostly historical — `/admin` predates `/org`. Plan a periodic "what should this page be?" audit and migrate as appropriate.
**Confidence:** INFERRED
**Source:** /admin and /org page directory structure + inference

---

### Q-PORT-002: Should the admin portal have an "act as user" / impersonation feature for support cases?

**Scope:** Topic:Web-Portals
**Category:** UX
**Priority:** CLARIFYING
**Question:** When an SV support engineer needs to diagnose a partner manager's issue, today they read logs. Should there be an impersonation UI?
**Answer:** Defer until clear need. Impersonation is a security/audit liability and the SV team is small enough that screen-shares with partners suffice. Revisit when partner volume + support tickets justify it.
**Confidence:** INFERRED
**Source:** Admin pages + inference

---

### Q-PORT-003: Are the `/admin/properties`, `/admin/contributions`, `/admin/data-intelligence`, `/admin/debug`, `/admin/test`, `/admin/verify-firestore`, `/admin/migrate` pages still useful or dead?

**Scope:** Topic:Web-Portals
**Category:** UX
**Priority:** CLARIFYING
**Question:** Several admin pages look like leftovers from migrations or feature spikes. Audit and remove?
**Answer:** Most are dead. Specifically: `properties` (B2C term superseded by `locations`), `debug`/`test`/`verify-firestore` (one-off diagnostics), `migrate` (migration scripts now obsolete post-B-phase). `contributions` and `data-intelligence` may still be relevant for the training data pipeline — verify with the ML side before deleting.
**Confidence:** INFERRED
**Source:** ls src/app/admin/ + inference

---

### Q-PORT-004: Is the `/org` portal feature-complete for partner_managers, or still in beta?

**Scope:** Topic:Web-Portals
**Category:** UX
**Priority:** CLARIFYING
**Question:** `/org` has only 5 pages (dashboard, locations list/detail, tasks, team). For a partner_manager running a real OEM, is this enough surface, or are there gaps (e.g., billing, analytics deep-dives, teleop performance)?
**Answer:** Minimum viable. Most managers also have access via direct admin support or have a SuperVolcano account manager. The `/org` portal can grow as partners self-serve more. Add: org-level analytics, billing/usage page, team management with invite flow, exports.
**Confidence:** INFERRED
**Source:** ls src/app/org/ + inference

---

## Topic: CI/CD & Deployment

### Q-DEP-001: Is the "no review gate on main" deployment model appropriate for staging, or should staging also require PR approval?

**Scope:** Topic:CI-Deployment
**Category:** TA
**Priority:** CLARIFYING
**Question:** CI deploys staging on every `main` push — no PR/review gate. Prod requires a tag + GitHub `production` environment approval. Is the staging-on-main flow durable, or risky as the team grows?
**Answer:** Durable for now (small team, fast iteration). When the team grows past ~4 engineers or partner production usage gets serious, add a PR review gate on `main` and treat staging like a near-prod environment. Until then, the current speed/safety tradeoff is right.
**Confidence:** INFERRED
**Source:** .github/workflows/deploy-staging.yml + CLAUDE.md L188-196 + inference

---

### Q-DEP-002: Should NEXT_PUBLIC env values continue to be Docker build-args, or move to runtime env?

**Scope:** Topic:CI-Deployment
**Category:** TA
**Priority:** CLARIFYING
**Question:** Build-time inlining means changing a NEXT_PUBLIC value requires a fresh image. Could be moved to runtime via a `/api/config` endpoint or by setting them on Cloud Run env. Trade-offs?
**Answer:** Keep build-time inlining. Build-arg + per-env image is simpler, predictable, and the only "drift risk" (mismatch between env var and image) is caught by smoke test. Runtime config adds an extra round-trip and a failure mode (config endpoint down). Not worth it for the marginal flexibility.
**Confidence:** INFERRED
**Source:** Dockerfile + deploy-staging.yml build-args + inference

---

### Q-DEP-003: When should the prod cutover from Vercel/legacy Firebase happen?

**Scope:** Topic:CI-Deployment
**Category:** TA / BL
**Priority:** BLOCKING
**Question:** Staging is live on Cloud Run + new Firestore. Prod is still… where? Vercel? Legacy? When + how does prod cutover happen?
**Answer:** Prod cutover blocks on: (1) full mobile QA on staging, (2) prod-tenant user import script, (3) sweeping all `adminAuth.*` admin endpoints, (4) DNS swap, (5) data migration from prod Firestore (legacy) to new prod-db. Plan a maintenance window. Don't cut over until at least 2 weeks of staging stability.
**Confidence:** INFERRED
**Source:** Current state of staging + open admin Auth bugs + inference

---

### Q-DEP-004: Should the GitHub Actions deprecation warnings (Node 20 actions) be addressed proactively?

**Scope:** Topic:CI-Deployment
**Category:** TA
**Priority:** CLARIFYING
**Question:** CI prints deprecation warnings for `actions/checkout@v4`, `actions/setup-node@v4`, `pnpm/action-setup@v4` (Node 20 → Node 24 in 2026-06). Bump now or wait for forced default?
**Answer:** Bump proactively when the v5 versions land. Set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` in workflows now to opt in early and surface any incompatibilities before the cutover. Cheap, safe.
**Confidence:** INFERRED
**Source:** CI deprecation warnings + inference

---

### Q-DEP-005: Is the Terraform-managed runtime SA role list complete, or are more grants needed as features land?

**Scope:** Topic:CI-Deployment
**Category:** TA
**Priority:** CLARIFYING
**Question:** Runtime SA now has `cloudsql.client`, `datastore.user`, `firebaseauth.admin`, `identityplatform.admin` (added this session), logging, monitoring, tracing. Likely future needs: Cloud Tasks invoker, Pub/Sub publisher, Secret Manager accessor. Are these baked in proactively or added per-feature?
**Answer:** Add per-feature. Over-granting roles up-front violates least-privilege. The pattern of "feature breaks → identify missing role → add to terraform → apply" is correct. Document each grant's purpose with a comment, as done for `identityplatform.admin`.
**Confidence:** INFERRED
**Source:** infra/terraform/iam.tf cloud_run_roles + inference

---

## User Flow Questions

### UF:TBD-Offline-Recording-Mode: Generic Offline Recording

### Q-UFTBD-001: What is required before generic recording starts?

**Scope:** UF:TBD-Offline-Recording-Mode
**Category:** BL, UX, TA
**Priority:** BLOCKING
**Question:** When a worker starts a generic recording session without an assigned task, what information must the app require before recording can begin?
**Answer:** Require only authenticated worker identity before recording begins. The generic offline recording flow must be accessible from the app home page after login. Do not block recording on location or task selection before capture. At upload time, require both location and task before upload can proceed.
**Confidence:** CONFIRMED
**Source:** Supervolcano Production Readiness Report v2.md item #13; PB interactive session 2026-04-23, refined by later confirmed upload validation decisions in the same session

### Q-UFTBD-002: Where is generic media stored and when does upload start?

**Scope:** UF:TBD-Offline-Recording-Mode
**Category:** BL, TA
**Priority:** BLOCKING
**Question:** Where should a generic offline recording be stored locally, and what exact upload trigger should the app use once connectivity returns?
**Answer:** Store recordings in a durable app-controlled local queue, not a temporary directory. Mark each item as `needs_assignment` until the worker selects a location. When the device regains network connectivity, the app should surface the pending recording immediately and auto-attempt upload only after required metadata is completed.
**Confidence:** CONFIRMED
**Source:** Supervolcano Production Readiness Report v2.md items #13 and #18; PB interactive session 2026-04-23

### Q-UFTBD-003: Can one recording map to multiple assignments?

**Scope:** UF:TBD-Offline-Recording-Mode
**Category:** BL, UX
**Priority:** BLOCKING
**Question:** At upload time, can one generic recording be assigned to only one location/task pair, or can a worker split or reassign parts of a recording across multiple locations or tasks?
**Answer:** One recording maps to exactly one final assignment. Do not support splitting a single recording across multiple locations or tasks in v1. Allow the worker to change the pending assignment before upload confirmation, but once upload starts, treat the assignment as locked.
**Confidence:** CONFIRMED
**Source:** PB interactive session 2026-04-23

### Q-UFTBD-004: Is generic recording shown when online?

**Scope:** UF:TBD-Offline-Recording-Mode
**Category:** BL, UX
**Priority:** BLOCKING
**Question:** When the worker is online and assigned tasks are available, should the generic recording flow still be shown as a first-class option on the home page, and if so, when should the app steer the worker toward assigned-task recording instead?
**Answer:** Yes, show generic recording as a first-class option on the logged-in home page even when online. Present assigned-task recording as the default or recommended path when tasks are available, but do not hide or disable generic recording. If the worker chooses generic recording while online, allow it and apply the same upload-time assignment rules.
**Confidence:** CONFIRMED
**Source:** Supervolcano Production Readiness Report v2.md item #13; PB interactive session 2026-04-23

### Q-UFTBD-005: What happens if pending uploads already exist?

**Scope:** UF:TBD-Offline-Recording-Mode
**Category:** BL, UX, TA
**Priority:** BLOCKING
**Question:** What should happen if a worker has one or more pending generic recordings that still need assignment, but they try to start a new recording session?
**Answer:** Allow starting a new recording even if pending generic recordings still need assignment or upload. Show a clear warning and keep pending items visible. When the user enters the generic flow, split it into two paths: `Assign pending uploads` and `Do a recording`. Do not hard-block new recording unless storage is low or there is an unfinished corrupted session that needs recovery.
**Confidence:** CONFIRMED
**Source:** PB interactive session 2026-04-23

### Q-UFTBD-006: Which task and location list is authoritative?

**Scope:** UF:TBD-Offline-Recording-Mode
**Category:** BL, TA
**Priority:** BLOCKING
**Question:** When a worker later assigns a pending generic recording, should the app use the worker's current live list of allowed locations and tasks at assignment time, or should it preserve some offline snapshot from when the recording was created?
**Answer:** Use the current live authorized list at assignment time once the device is online. Do not rely on an old offline snapshot for final assignment. If a previously valid task is no longer available, require the worker to choose from the current allowed options.
**Confidence:** CONFIRMED
**Source:** PB interactive session 2026-04-23

### Q-UFTBD-007: Is task selection optional at upload time?

**Scope:** UF:TBD-Offline-Recording-Mode
**Category:** BL, UX
**Priority:** BLOCKING
**Question:** At upload time, if the worker selects a location that has active tasks, is task selection still optional, or must the worker choose one of those tasks before upload can proceed?
**Answer:** At upload time, task selection is always required. After the worker selects a location, the app must require selection of one task before upload can proceed.
**Confidence:** CONFIRMED
**Source:** PB interactive session 2026-04-23

### Q-UFTBD-008: What if no valid task exists at assignment time?

**Scope:** UF:TBD-Offline-Recording-Mode
**Category:** BL, UX, TA
**Priority:** BLOCKING
**Question:** What should the app do if the worker reaches upload-time assignment, selects a location, and there are no available tasks for that location?
**Answer:** If the worker selects a location and there are no available tasks for that location, do not allow upload for that location. Keep the recording in the pending queue and allow the worker to choose a different location, retry later after tasks sync, or delete the recording if the task they intended to upload to no longer exists.
**Confidence:** CONFIRMED
**Source:** PB interactive session 2026-04-23

### Q-UFTBD-009: What delete behavior is required for pending recordings?

**Scope:** UF:TBD-Offline-Recording-Mode
**Category:** BL, UX, TA
**Priority:** BLOCKING
**Question:** If a worker deletes a pending generic recording before upload, should that deletion require confirmation only, or should the app also capture a reason or retain any audit metadata about the deleted recording?
**Answer:** Require a destructive-action confirmation, but do not require a reason in v1. Retain lightweight local audit metadata if feasible, such as created-at timestamp, size, and deleted-at timestamp, without preserving the video file itself after deletion.
**Confidence:** CONFIRMED
**Source:** PB interactive session 2026-04-23

### Q-UFTBD-010: What makes a recording ready to upload?

**Scope:** UF:TBD-Offline-Recording-Mode
**Category:** UX, TA
**Priority:** BLOCKING
**Question:** What user-visible status states must exist for a generic recording in the pending queue from creation through final upload?
**Answer:** A generic recording should remain in a pending state until the user completes all required metadata in the assignment modal, including location and task. After that, show a final `Upload` button that explicitly begins the upload process.
**Confidence:** CONFIRMED
**Source:** PB interactive session 2026-04-23

### Q-UFTBD-011: What is the first screen inside generic recording?

**Scope:** UF:TBD-Offline-Recording-Mode
**Category:** UX, TA
**Priority:** BLOCKING
**Question:** When a worker taps the generic recording entry point from the home page, what exact first screen should they see: a simple chooser with `Assign pending uploads` and `Do a recording`, or a queue screen that also contains the record action?
**Answer:** Start with a simple chooser screen containing two primary actions: `Assign pending uploads` and `Do a recording`. If pending items exist, show the pending count on the first option. Keep the full queue inside the assignment flow rather than overloading the entry screen.
**Confidence:** CONFIRMED
**Source:** PB interactive session 2026-04-23

### Q-UFTBD-012: Is assignment forced immediately after recording?

**Scope:** UF:TBD-Offline-Recording-Mode
**Category:** BL, UX, TA
**Priority:** BLOCKING
**Question:** After a worker finishes a generic recording while still offline, should the app immediately force them into the assignment flow, or return them to the generic chooser or home context and let them assign later?
**Answer:** Do not force assignment immediately after recording finishes. Return the worker to the generic chooser or home context with a clear pending-upload indicator, and let them assign later when they are ready and online.
**Confidence:** CONFIRMED
**Source:** PB interactive session 2026-04-23

### Q-UFTBD-013: How should the app surface pending uploads after reconnect?

**Scope:** UF:TBD-Offline-Recording-Mode
**Category:** TA, UX
**Priority:** BLOCKING
**Question:** If connectivity returns while the worker is actively using the app, should the app automatically interrupt them with the pending-assignment flow, or only show a non-blocking prompt or badge until they choose to open it?
**Answer:** Do not interrupt the worker with a forced modal. Show a clear non-blocking prompt or badge on the home page and generic chooser, and let the worker enter `Assign pending uploads` intentionally.
**Confidence:** CONFIRMED
**Source:** PB interactive session 2026-04-23

### Q-UFTBD-014: How does upload recover from interruption?

**Scope:** UF:TBD-Offline-Recording-Mode
**Category:** TA, UX
**Priority:** BLOCKING
**Question:** If a worker taps the final `Upload` button for a pending generic recording and the upload starts, what should happen if the app is closed, backgrounded, or loses connection before completion?
**Answer:** Persist the item in the upload queue with its assigned location and task locked, show it as `Uploading` or `Upload failed` as appropriate, and resume or retry through the existing reconnect-capable upload queue when the app returns or connectivity is restored. Do not require the worker to re-enter metadata unless the upload record is proven invalid.
**Confidence:** CONFIRMED
**Source:** Supervolcano Production Readiness Report v2.md item #12; PB interactive session 2026-04-23

### Q-UFTBD-015: Who can access generic recording?

**Scope:** UF:TBD-Offline-Recording-Mode
**Category:** BL, UX
**Priority:** BLOCKING
**Question:** Should there be any eligibility restrictions on who can use generic recording, or is it available to every logged-in worker role that can normally record assigned tasks?
**Answer:** Make generic recording available to the same worker roles that are already allowed to record assigned tasks. Do not introduce a separate permission gate in v1 unless there is a known compliance or operational reason to restrict it.
**Confidence:** CONFIRMED
**Source:** PB interactive session 2026-04-23

### Q-UFTBD-016: How are duplicate uploads prevented?

**Scope:** UF:TBD-Offline-Recording-Mode
**Category:** TA, UX
**Priority:** BLOCKING
**Question:** If the worker taps the final `Upload` button multiple times, or reopens the app during an in-progress upload, what duplicate-prevention behavior should the system guarantee?
**Answer:** Treat upload initiation as idempotent per pending recording. After the worker taps `Upload`, disable repeated submission for that item, keep a single queue entry, and ensure app restarts resume the same upload job rather than creating duplicates.
**Confidence:** CONFIRMED
**Source:** PB interactive session 2026-04-23

---

## Flagged for PB Review

### Open Questions (need PB attestation to elevate from INFERRED to CONFIRMED)

The 2026-05-19 audit-seeded entries (`Q-PROJ`, `Q-DATA`, `Q-AUTH`, `Q-ROLE`, `Q-LOC`, `Q-MOB`, `Q-PORT`, `Q-DEP`) are all `INFERRED`. Walk them in priority order (BLOCKING first), and for each:

- `✓` to accept the inference → upgrade to CONFIRMED
- Edit to revise → upgrade to CONFIRMED with your text
- Leave as-is → stays INFERRED

The 2026-04-23/24 entries (`Q-MCMS`, `Q-MCR`, `Q-MEH`, `Q-UFTBD`) are already `CONFIRMED` from PB sessions.

### Bugs surfaced during the 2026-05-19 audit (independent of FAQ — fix tickets)

1. **`scripts/seed-superadmin.ts` writes `organization_id` (snake_case) but `getUserClaims` reads `organizationId` (camelCase).** Superadmin org claim doesn't propagate. Fix the script. (Q-AUTH-006)
2. **`scripts/set-admin-role.ts` writes `partner_org_id` but code reads `partnerId`.** Same class of bug. (Q-AUTH-006)
3. **6 admin endpoints still use project-level `adminAuth.*`** instead of `authForTenant`. Sweep needed. (Q-AUTH-003)
4. **`tasksRepo.ts` is dead code** — never imported. Delete. (Q-DATA-005)
5. **CLAUDE.md says `assignedTeleoperatorIds`** but code uses `assignedOrganizationId`. Update CLAUDE.md. (Q-LOC-004)
6. **`/api/teleoperator/media/metadata` route exists but is never called from mobile.** Either delete or wire up. (Q-MOB-007)
7. **`MemberRecordScreen.tsx` hardcodes `totalHoursUploaded = 4.2`.** Placeholder; either implement or remove. (Q-MOB-006)
8. **`/admin/locations/new` claims "Step 1 of 3"** but is only step 1. Relabel or split. (Q-LOC-002)
9. **`member` role is referenced in mobile but not defined in web** UserRole / permissions. Either commit or remove. (Q-PROJ-008)
10. **Several `/admin/*` pages (`properties`, `debug`, `test`, `verify-firestore`, `migrate`) are stale.** Audit + delete. (Q-PORT-003)

---

_End of merged ProdFAQ._
