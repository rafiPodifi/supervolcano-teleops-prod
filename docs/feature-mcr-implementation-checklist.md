# Feature Mobile Crash Reporting Implementation Checklist

_Last updated: 2026-04-24_

## Source

- Production Readiness Report v2 mobile P1 item #5.
- ProdFAQ `Topic:Mobile-Crash-Reporting` — Q-MCR-001 through Q-MCR-012.
- ProdFAQ `Project-Wide` — Q-MCR-013 (web dashboard out of scope in v1).

## Decisions Locked (ProdFAQ)

- Provider: Firebase Crashlytics via `@react-native-firebase/crashlytics`.
- Silent reporting. No user-facing UI. Fallback screen unchanged (Q-MEH-001).
- Anonymized Firebase Auth UID only. Strict PII allowlist for custom attributes.
- Three-layer symbolication via EAS CI (Android native, ProGuard, Hermes source maps).
- Separate Firebase projects for staging and prod.
- Slack alert routing (new issue + >1% velocity).
- React error boundary + global JS handler + unhandled promise rejection wired in `App.tsx`.
- Central `logError` helper at `src/utils/logError.ts`. Six mandatory v1 call sites.
- Default-on for all authenticated workers (no opt-in UI).

## Dependencies and Native Configuration

- [x] `npm install @react-native-firebase/app @react-native-firebase/crashlytics` in `mobile-app/` (installed at `^24.0.0`).
- [x] Add `@react-native-firebase/app` and `@react-native-firebase/crashlytics` to `app.json` `expo.plugins`.
- [x] Add `android.googleServicesFile: "./google-services.json"` in `app.json` (path reserved; file must be placed before build).
- [ ] **BLOCKS BUILD:** Download `google-services.json` from Firebase Console → `super-volcano-oem-portal` project → Project Settings → Your apps → Android (`com.supervolcano.camera`) → Register app if missing → download config. Save to `mobile-app/google-services.json` (gitignore it; commit an example path).
- [ ] Create separate staging Firebase project and repeat for staging `google-services.json`.
- [ ] Wire `google-services.json` selection per EAS build profile (`preview` → staging, `production` → prod) via EAS env overrides or split `app.config.js`.
- [ ] Enable `firebaseCrashlytics.mappingFileUploadEnabled = true` in Android release variant `build.gradle` (after `npx expo prebuild --clean`).
- [ ] Rebuild dev client after install (`npx expo prebuild --clean` then `npm run eas:build:android` or `npx expo run:android`).

## Core Utilities

- [x] Create `mobile-app/src/utils/crashlytics.ts` — thin wrapper around SDK with PII allowlist, lazy-require so app runs cleanly when SDK is absent (dev/CI).
- [x] Create `mobile-app/src/utils/logError.ts` — non-fatal error reporter with `LogErrorContext` shape.
- [x] Create `mobile-app/src/utils/logBreadcrumb.ts` — breadcrumb helper for five event categories.

## App Startup and Error Boundary

- [x] `App.tsx` — call `setCrashlyticsCollectionEnabled(true)` on startup.
- [x] `App.tsx` `ErrorBoundary.componentDidCatch` — call `logError` before rendering fallback; keep fallback copy unchanged (Q-MEH-001).
- [x] `App.tsx` — install global JS error handler via `ErrorUtils.setGlobalHandler` preserving RN default behavior.
- [x] `App.tsx` — install unhandled promise rejection tracker via `promise/setimmediate/rejection-tracking` if available; fall back to default RN behavior otherwise.

## Auth Integration

- [x] `AuthContext.tsx` — `setUserId(firebaseUser.uid)` on sign-in and auth state change.
- [x] `AuthContext.tsx` — `setUserId('')` on sign-out.
- [x] `AuthContext.tsx` — replace `console.error` with `logError` for profile-refresh, sign-in, sign-out unexpected errors (not credential errors).

## Mandatory Call Sites — logError wiring

- [x] `src/services/upload-queue.service.ts` — on max-retries reached (`retryCount >= MAX_RETRIES`), call `logError(error, { category: 'upload', action: 'retries-exhausted' })`.
- [x] `src/screens/member/MemberRecordScreen.tsx` — mode-switch timeout (`modeSwitchTimeoutRef` timer fires) + external catch block — `logError(..., { category: 'mode-switch', action: 'timeout' | 'external-init-failed' })`.
- [x] `src/screens/CameraScreen.tsx` — mode-switch timeout + external catch + native catch — same categories.
- [x] `src/hooks/useExternalCameraDiagnostics.ts` — external camera init failure paths currently using `console.warn`.
- [x] `src/native/external-camera.ts` — native module failures currently using `console.warn`.

## Breadcrumbs

- [x] Camera lifecycle — mode-switch start/success/timeout/cancel breadcrumbs in `MemberRecordScreen.tsx` and `CameraScreen.tsx`.
- [ ] Navigation — `NavigationContainer` `onStateChange` emits `nav: enter <ScreenName>` breadcrumbs. (Deferred — requires navigation state introspection; safe follow-up.)
- [ ] Recording lifecycle — session start/stop/segment breadcrumbs in both record screens. (Deferred.)
- [ ] Upload queue state transitions breadcrumbs in `upload-queue.service.ts`. (Deferred.)
- [ ] Network state transitions breadcrumbs (`@react-native-community/netinfo` listener). (Deferred.)

## CI / Symbolication

- [ ] Add GitHub Action or EAS post-build hook to upload Android `mapping.txt` to Crashlytics.
- [ ] Add hook to upload Hermes `.bundle.map` / `.hbc.map` via Crashlytics REST API.
- [ ] Automate `versionCode`/`versionName` bumping via `eas.json` auto-increment.
- [ ] Configure OTA `eas:update` to reuse existing Crashlytics release (no version bump).

## Alert Routing

- [ ] Firebase Console → prod project → Integrations → Slack: configure new-issue alert to target prod Slack channel.
- [ ] Firebase Console → prod project → Integrations → Slack: configure velocity alert (>1% sessions) to target same channel.
- [ ] Repeat for staging project with lower-priority channel (e.g. `#supervolcano-alerts-staging`).
- [ ] Confirm Slack channel names with PB and document in ops runbook.

## Validation

- [ ] Force a fatal JS exception in a dev build; confirm it appears in Crashlytics within 60s.
- [ ] Force a native crash via a test-only button; confirm it appears with symbolicated stack.
- [ ] Force an unhandled promise rejection; confirm it appears as non-fatal.
- [ ] Trigger a mode-switch timeout with external camera disconnected; confirm `logError` reports non-fatal with `category: mode-switch`, `action: timeout`.
- [ ] Trigger an upload failure past MAX_RETRIES; confirm `logError` reports non-fatal with `category: upload`, `action: retries-exhausted`.
- [ ] Sign in as a worker; confirm Crashlytics user ID is the Firebase UID, not email or name.
- [ ] Sign out; confirm Crashlytics user ID is cleared.
- [ ] Verify no PII in crash report custom keys, breadcrumbs, or error messages.
- [ ] Verify staging crashes appear only in staging Crashlytics project, prod crashes only in prod.
- [ ] Verify Slack channel receives a new-issue alert from a triggered crash.
- [ ] Verify symbolicated JS stack trace in Crashlytics UI from a production-configured build.
