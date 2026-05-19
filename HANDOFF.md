# Handoff — 2026-05-19

Pick-up notes for 2026-05-20. Covers what changed today, what is still
broken, and what to tackle next.

---

## Current status

### Done today (uncommitted — see "Git state")

1. **Admin user sync 500 — FIXED.**
   `src/app/api/admin/users/[id]/route.ts` GET/PATCH/DELETE were using root
   `adminAuth` for user-pool operations. Identity Platform users live in a
   tenant pool, so root auth returned `auth/user-not-found` → 500 ("Server
   error"). Now scoped via `authForTenant(decodedToken.firebase.tenant)`,
   matching the create route. Root `adminAuth` is kept only for
   `verifyIdToken`.

2. **Mobile task loading — FIXED (pending deploy).**
   Mobile queried the top-level `tasks` collection directly with the client
   SDK; the Firestore rule keys on `partnerOrgId` and the query only filters
   `locationId`, so the whole query was rejected (`permission-denied` →
   "Permission needed").
   - New backend route: `src/app/api/mobile/locations/[id]/tasks/route.ts`
     — verifies token, checks the caller has an active `assignments` row for
     the location, then queries `tasks` with the Admin SDK.
   - `mobile-app/src/services/api.ts` `fetchJobsForLocation` rewritten to
     call that endpoint instead of Firestore. Unused `query`/`where`/`or`
     imports dropped.

3. **"No internet" false alarm — FIXED.**
   `fetchJobsForLocation` error message contained the substring "failed to
   fetch", which `user-facing-error.ts` classifies as a connectivity error.
   Message changed to `Jobs request returned <status>`.

4. **CLAUDE.md** — added subsections: tenant-scoped Auth, dual-stored user
   identity, mobile data access, mobile error copy.

### Verified clean

- Web `tsc --noEmit` passes.
- Mobile `api.ts` typechecks; pre-existing baseline errors in
  `JobSelectScreen.tsx` (missing `Colors`/`Typography` keys, `Job.priority`)
  are unrelated and CI-tolerated.

---

## Still broken — found in audit, NOT yet fixed

### A. InviteCleanerScreen — owners cannot invite cleaners 🔴

`mobile-app/src/screens/owner/InviteCleanerScreen.tsx:66` does
`addDoc(collection(db,'location_invites'), ...)`. The Firestore rule
requires `locations/{locationId}.ownerId == request.auth.uid`. But
`src/app/api/locations/route.ts` POST writes location docs with
`assignedOrganizationId: owner:<uid>` and `createdBy: email` — **never
`ownerId`**. So the invite create is denied; UI shows "Failed to generate
invite link".
**Fix:** add `ownerId: uid` to the location doc in `/api/locations` POST,
then backfill `ownerId` on existing location documents.

### B. useRecordingConfig — admin recording settings never reach mobile 🟡

`mobile-app/src/hooks/useRecordingConfig.ts` subscribes to
`config/recording-settings`. No Firestore rule covers the `config`
collection → default deny → the `onSnapshot` error handler silently falls
back to `DEFAULTS`. No crash, no log — recording quality/audio/inactivity
timeout configured by admins is ignored.
**Fix:** add `match /config/{id} { allow read: if isAuthenticated(); }` to
`src/firebase/firestore.rules`, then deploy rules.

### C. locations.service.ts — dead code landmine 🟡

`mobile-app/src/services/LocationsService` is imported nowhere. Its query
filters `assignedOrganizationId` while the rule checks
`assignedOrganizations`/`organizationId` — it would be denied if ever wired
up.
**Fix:** delete the file.

### D. Cross-org location read leak — security 🟠

`src/firebase/firestore.rules`, locations collection:
`allow read: if isAuthenticated() && (isManager() || resource.data.ownerId == request.auth.uid)`.
`isManager()` is true for any `partner_manager` or `location_owner`, so
**any manager/owner can read every location across all orgs**. The mobile
owner screens currently "work" only because of this hole.
**Fix:** redesign the locations read rule to scope by org/ownership — needs
a decision, not a one-liner.

---

## Tomorrow — suggested order

1. **Deploy the web/API to Cloud Run** (push to `main`). This ships the new
   `/api/mobile/locations/[id]/tasks` route and unblocks mobile task
   loading. Until then the phone gets a 404.
2. **Build & ship the mobile app** with the `api.ts` changes (EAS update or
   build, depending on whether OTA covers it).
3. **End-to-end verify** after deploy:
   - Admin user edit / sync save (the original 500).
   - Mobile: tap a location → tasks list loads.
4. **Fix A** — `ownerId` on location create + backfill script for existing
   docs.
5. **Fix B** — `config` read rule + `pnpm run deploy-rules`.
6. **Fix C** — delete `locations.service.ts`.
7. **Fix D** — decide and implement the locations read-rule redesign
   (cross-org leak).

---

## Git state

Branch: `main`. All of today's work is **uncommitted**:

- `src/app/api/admin/users/[id]/route.ts` (modified)
- `src/app/api/mobile/locations/[id]/tasks/route.ts` (new)
- `mobile-app/src/services/api.ts` (modified)
- `CLAUDE.md` (modified)
- `HANDOFF.md` (this file, new)

Also untracked, pre-existing, not from this session:
`scripts/seed-mobile-user.ts`.

Commit before deploying. Prod deploy is gated on a `v*` git tag with manual
approval; a `main` push deploys staging.
