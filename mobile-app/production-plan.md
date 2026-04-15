# Mobile App Production Readiness Plan

This document summarizes current issues in the mobile app and a prioritized remediation plan.

## Priority Scale
- P0: Absolute requirement for production release.
- P1: High priority; should be completed before broad rollout.
- P2: Medium priority; improves reliability, maintainability, or observability.
- P3: Low priority; optimization and polish.

## Issues (Prioritized)

### P0 - Absolute Requirements
- Auth trust and role gating are client-only; cached profiles can render privileged screens before server confirmation.
- Privileged writes (location structure, invites, media metadata) happen directly from the client; server-side validation is missing.
- API base configuration is inconsistent across screens and services, risking calls to the wrong backend.
- Verbose logs include user data and are not gated for production.
- Member flow uses mock data and does not persist recordings or sessions (if shipping).

### P1 - High Priority
- Split media ingestion paths (legacy queue/API vs new queue/Firestore) produce incompatible schemas.
- Large video uploads are loaded into memory via blob fetch, risking OOM on mid-tier devices.
- Queue processing only starts from certain screens and retry intervals are not lifecycle-aware.
- Local storage can grow unbounded; failed items do not expire and file extensions are inconsistent.
- Segment timers and state are fragile on backgrounding and app restarts.
- Firebase config is embedded in app.json and env key usage is inconsistent.
- Duplicate type definitions and role enums drift (e.g., missing member in one type file).

### P2 - Medium Priority
- Mixed data-access patterns (direct Firestore + API calls) without a unified client.
- Offline detection relies on error string matching instead of explicit network state.
- Two camera stacks are configured (expo-camera and vision-camera), inflating size and permissions.
- BLE/background permissions declared while GoPro flow is disabled in Expo Go.
- No automated tests or telemetry beyond a manual storage test helper.

### P3 - Low Priority
- Legacy screens and debug-heavy services remain in the codebase.
- Services trigger UI alerts directly, complicating testing and reuse.

## Remediation Plan (Prioritized)

### P0 - Absolute Requirements
- Identity and access control
  - Strategy: Make the server authoritative for role and org access.
  - Actions: Verify ID token on privileged APIs, enforce role/org checks, remove default-to-cleaner fallback, block cached profile until verified.
  - Done when: Unauthorized users cannot read/write privileged data even with cached profiles.
- Privileged writes boundary
  - Strategy: Move sensitive writes off the client.
  - Actions: Create server endpoints for location structure, invites, media metadata; lock Firestore rules to deny direct client writes.
  - Done when: Client only uses authenticated APIs for privileged mutations.
- Environment configuration
  - Strategy: Single source of truth.
  - Actions: Standardize one API base env var, fail fast on missing config, separate dev/stage/prod Firebase projects.
  - Done when: Prod build cannot run with dev endpoints.
- Logging and PII
  - Strategy: Production-safe logging.
  - Actions: Gate debug logs, scrub PII, add runtime log level control.
  - Done when: Release builds emit minimal non-PII logs.
- Location assignment and filtering
  - Strategy: Server-driven access.
  - Actions: Use one assignments API with token auth, remove fallback to "show all", cache with TTL.
  - Done when: Users only see assigned locations.
- Member flow decision (if shipping)
  - Strategy: Ship or remove.
  - Actions: Wire to backend with real sessions/uploads or hide behind a feature flag.
  - Done when: No mock data ships in production.

### P1 - High Priority
- Upload pipeline unification
  - Strategy: One queue and one metadata path.
  - Actions: Delete legacy queue/API path, standardize media schema, ensure idempotent uploads and metadata writes.
  - Done when: Every upload follows a single path and downstream consumers see consistent fields.
- Queue durability and storage hygiene
  - Strategy: Deterministic lifecycle.
  - Actions: Persist queue versioning, clean old failed items, fix file extensions/naming, add disk usage limits.
  - Done when: Queue survives restarts without leaks and storage stays bounded.
- Resumable, memory-safe uploads
  - Strategy: Avoid large in-memory blobs.
  - Actions: Use file-path streaming or chunked uploads, cap segment duration by device, add exponential backoff.
  - Done when: Long recordings upload on mid-tier devices without OOM.
- Background processing reliability
  - Strategy: Explicit lifecycle management.
  - Actions: Wire NetInfo, integrate background tasks where supported, start queue processing on app launch.
  - Done when: Uploads continue after app restarts/backgrounding.
- Permissions and background modes
  - Strategy: Least privilege.
  - Actions: Remove unused permissions/background modes, gate BLE/camera flows behind feature flags.
  - Done when: App permissions match actual features.

### P2 - Medium Priority
- Data model consolidation
  - Strategy: One type system.
  - Actions: Merge duplicate type definitions, align role enums, add runtime validation at API boundaries.
  - Done when: Types match backend schemas and runtime errors drop.
- Observability
  - Strategy: Actionable telemetry.
  - Actions: Add crash reporting, structured events for upload stages, per-device health metrics.
  - Done when: Failures are traceable by user/session.
- Testing and CI
  - Strategy: Protect critical flows.
  - Actions: Unit tests for auth/queue/upload services, integration tests for API auth, EAS smoke tests.
  - Done when: CI blocks regressions in auth and uploads.
- Error handling UX
  - Strategy: Consistent recovery.
  - Actions: Central error map, retry UI for failed uploads, offline banners.
  - Done when: Users can recover without reinstalling.
- Release hygiene
  - Strategy: Stable release process.
  - Actions: Versioned config, feature flags, staged rollout with rollback.
  - Done when: Releases can be halted or reverted safely.
- Security hardening
  - Strategy: Defense in depth.
  - Actions: Secure local storage, logout wipe, review token handling.
  - Done when: Device compromise has limited impact.

### P3 - Low Priority
- Performance and bundle size
  - Strategy: Remove unused deps and duplicate stacks.
  - Actions: Choose one camera stack, trim packages, lazy-load heavy screens.
  - Done when: Startup and install size improve measurably.
- Product polish
  - Strategy: Complete workflows.
  - Actions: Upload progress UI, manual retry controls, accessibility pass.
  - Done when: Primary flows are smooth for non-technical users.
