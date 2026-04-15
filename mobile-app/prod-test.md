# Mobile App Production Readiness Test Cases

This document lists the test cases to validate production readiness for the mobile app.

## Priority Scale
- P0: Absolute requirement for production release.
- P1: High priority; should be completed before broad rollout.
- P2: Medium priority; improves reliability, UX, or compliance.
- P3: Low priority; nice-to-have coverage.

## Test Matrix (minimum)
- iOS: latest + 1 previous major version
- Android: latest + 1 previous major version
- Devices: at least one low-memory Android device and one mid-tier iPhone
- Network: Wi-Fi, LTE, offline, flaky/intermittent

## P0 - Absolute Requirements

### Authentication and Session
- TC-AUTH-01: Valid login
  - Steps: Sign in with valid user for each role.
  - Expected: Role-based navigation, profile loaded from server, cached profile saved.
- TC-AUTH-02: Invalid credentials
  - Steps: Sign in with wrong password.
  - Expected: Clear error message, no navigation, no profile cache.
- TC-AUTH-03: Role not allowed
  - Steps: Sign in with a role not permitted on mobile.
  - Expected: Access denied message, user signed out, no access to screens.
- TC-AUTH-04: Token expiry
  - Steps: Force token expiration then perform an API call.
  - Expected: Token refresh or re-auth flow; no silent failure.
- TC-AUTH-05: Cached profile mismatch
  - Steps: Update user role or org on backend, relaunch app offline then online.
  - Expected: Cached profile replaced by server truth after reconnect.
- TC-AUTH-06: Sign out
  - Steps: Sign out from any screen.
  - Expected: Local profile cleared, queue access restricted, return to login.

### Role-Based Navigation
- TC-ROLE-01: Owner routing
  - Steps: Sign in as location_owner.
  - Expected: Owner tabs shown; no cleaner screens accessible.
- TC-ROLE-02: Cleaner routing
  - Steps: Sign in as location_cleaner or oem_teleoperator.
  - Expected: Cleaner stack shown; no owner screens accessible.
- TC-ROLE-03: Member routing
  - Steps: Sign in as member (if shipping).
  - Expected: Member stack only; no owner/cleaner screens accessible.
- TC-ROLE-04: Unknown role
  - Steps: Sign in with a role not recognized by the app.
  - Expected: Access denied or safe failure, no default to privileged flows.

### Configuration and Environment
- TC-CONFIG-01: Missing API base URL
  - Steps: Remove API base env var and launch app.
  - Expected: Startup error with clear guidance; no silent fallback.
- TC-CONFIG-02: Firebase config mismatch
  - Steps: Use wrong Firebase project in config.
  - Expected: Auth and Firestore errors are detected and surfaced.
- TC-CONFIG-03: Staging vs production
  - Steps: Build with staging config and production config.
  - Expected: App connects to correct backend and Firebase project.

### API Authorization and Access Control
- TC-API-01: Missing bearer token
  - Steps: Call protected API without token.
  - Expected: 401/403 handled; app shows proper error and recovery.
- TC-API-02: Cross-organization access
  - Steps: Attempt to fetch or mutate data for another org.
  - Expected: Server denies; app displays error.
- TC-API-03: Privileged mutation via client
  - Steps: Attempt direct Firestore write for privileged data (if still possible).
  - Expected: Security rules deny; app handles error.

### Locations and Assignments
- TC-LOC-01: Assigned locations only
  - Steps: Sign in as a cleaner with assigned locations.
  - Expected: Only assigned locations appear.
- TC-LOC-02: No assignments
  - Steps: Sign in with zero assignments.
  - Expected: Empty state shown; no crash.
- TC-LOC-03: Assignment change
  - Steps: Add/remove assignment on backend; refresh app.
  - Expected: Updated list after refresh or relaunch.

### Owner Flow (if shipping)
- TC-OWNER-01: Create location
  - Steps: Add location with Places autocomplete.
  - Expected: Location created; user navigates to wizard.
- TC-OWNER-02: Use current location
  - Steps: Use GPS and confirm address.
  - Expected: Address fills and can proceed.
- TC-OWNER-03: Wizard save
  - Steps: Complete floors/rooms/targets, save.
  - Expected: Structure saved via API, visible in detail screen.
- TC-OWNER-04: Detail view
  - Steps: Open location detail.
  - Expected: Structure stats render correctly; refresh works.
- TC-OWNER-05: Invite cleaner
  - Steps: Generate invite link and share.
  - Expected: Invite stored; link copies/shares correctly.

### Member Flow (if shipping)
- TC-MEMBER-01: Start session
  - Steps: Start recording in member flow.
  - Expected: Recording starts; timer updates; session saved on stop.

### Camera and Permissions (core)
- TC-CAM-01: Permissions grant
  - Steps: Accept camera and microphone permissions.
  - Expected: Camera opens and records.
- TC-CAM-02: Permissions denied
  - Steps: Deny camera or microphone.
  - Expected: Permission UI appears; settings link works.
- TC-CAM-03: Permission revoked
  - Steps: Revoke permission in OS settings while app is open.
  - Expected: App detects and blocks recording with clear guidance.

### Recording and Segmenting (core)
- TC-REC-01: Segment rotation
  - Steps: Record beyond segment duration.
  - Expected: New segment starts automatically with minimal gap.
- TC-REC-02: Stop session
  - Steps: Stop mid-segment.
  - Expected: Segment saved and queued; session ends cleanly.

### Upload Queue and Media Pipeline (core)
- TC-UPLOAD-01: Queue persistence
  - Steps: Record a segment, kill app, relaunch.
  - Expected: Queue persists and resumes upload.
- TC-UPLOAD-02: Upload success
  - Steps: Upload a segment with stable network.
  - Expected: Storage upload completes; metadata saved; local file deleted.
- TC-UPLOAD-03: Upload failure and retry
  - Steps: Cut network during upload.
  - Expected: Item marked failed and retried with backoff.
- TC-UPLOAD-04: Duplicate prevention
  - Steps: Force retry after partial upload.
  - Expected: Server-side idempotency prevents duplicate metadata.
- TC-UPLOAD-07: Offline queue
  - Steps: Record while offline; reconnect later.
  - Expected: Upload resumes automatically.
- TC-UPLOAD-08: Metadata integrity
  - Steps: Upload and verify media document schema.
  - Expected: All required fields present and consistent.

### Security
- TC-SEC-01: Sensitive data in logs
  - Steps: Review logs in release build during auth and upload.
  - Expected: No tokens or PII in logs.
- TC-SEC-02: Local storage cleanup
  - Steps: Sign out then inspect local storage state.
  - Expected: Profile cache and sensitive data cleared.

### Build and Release
- TC-BUILD-01: EAS production build
  - Steps: Build iOS/Android with production profile.
  - Expected: Build succeeds; correct bundle IDs and versioning.
- TC-BUILD-02: OTA updates
  - Steps: Publish update and confirm rollout.
  - Expected: Update applies only to matching runtime/version.

## P1 - High Priority

### Camera and Permissions
- TC-CAM-04: No camera device
  - Steps: Simulate missing camera device or emulator.
  - Expected: Safe error state shown.
- TC-CAM-05: Lens selection
  - Steps: Select each lens; use device without certain lenses.
  - Expected: Unavailable lens options disabled or handled safely.

### Recording and Segmenting
- TC-REC-03: App background during recording
  - Steps: Background app mid-session, then return.
  - Expected: Recording state is consistent; queue is processed.

### Upload Queue and Media Pipeline
- TC-UPLOAD-05: Storage full
  - Steps: Fill device storage then record.
  - Expected: User gets clear error; app does not crash.
- TC-UPLOAD-06: Large file memory
  - Steps: Record long segment on low-memory device.
  - Expected: Upload does not crash due to memory spikes.

### Offline and Network Conditions
- TC-NET-01: Cold start offline
  - Steps: Launch app without network.
  - Expected: Cached profile behavior is safe; limited actions.
- TC-NET-02: Flaky network
  - Steps: Toggle network during critical actions.
  - Expected: Graceful retries and user feedback.

### Background and Lifecycle
- TC-LIFE-01: App killed during upload
  - Steps: Force kill while uploading.
  - Expected: Queue resumes after relaunch without data loss.
- TC-LIFE-02: Device reboot
  - Steps: Reboot device with pending queue.
  - Expected: Queue persists and resumes.

### Error Handling and UX
- TC-ERR-01: API 500
  - Steps: Force API error on location create or structure save.
  - Expected: Clear error message and retry option.
- TC-ERR-02: Firebase permission error
  - Steps: Block Firestore access via rules.
  - Expected: App surfaces error and blocks sensitive actions.
- TC-ERR-03: Upload failure recovery
  - Steps: Force upload failure and use retry UI.
  - Expected: Retry works and status updates.

### Performance and Stability
- TC-PERF-02: Memory under load
  - Steps: Record and upload multiple segments.
  - Expected: No OOM, no UI lockups.

## P2 - Medium Priority

### Observability
- TC-OBS-01: Crash reporting
  - Steps: Trigger a controlled crash.
  - Expected: Crash captured with device and session metadata.
- TC-OBS-02: Upload telemetry
  - Steps: Upload a video.
  - Expected: Events logged for queue add, upload start, success/fail.

### Performance and Stability
- TC-PERF-01: App startup time
  - Steps: Cold start on low-memory device.
  - Expected: Start within target time without blank screen.

### Accessibility
- TC-A11Y-01: Screen reader
  - Steps: Navigate primary flows with VoiceOver/TalkBack.
  - Expected: Critical controls are accessible and labeled.

## P3 - Low Priority

### Member Flow (if shipping)
- TC-MEMBER-02: Reward progress
  - Steps: Complete sessions that cross reward thresholds.
  - Expected: Progress and milestones update correctly.
