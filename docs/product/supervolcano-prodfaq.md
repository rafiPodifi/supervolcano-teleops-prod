# Supervolcano ProdFAQ

_Last updated: 2026-04-24_

## Project-Wide Questions

### Q-MCR-013: Does crash reporting scope cover the web dashboard in v1?
**Scope:** Project-Wide
**Category:** TA, BL
**Priority:** CLARIFYING
**Question:** Does Production Readiness Report item #5 (no crash or error reporting) cover the web dashboard (`/src` Next.js) in the same pass, or is the v1 scope mobile-only?
**Answer:** Mobile-only in v1. Item #5 is placed inside Part 1 — Mobile App (Android) under P1. The dashboard equivalent is dashboard item #17 ("No system monitoring or performance dashboards"), tracked as a P3 observability gap in Part 2. Dashboard crash capture will require a separate tool evaluation (Sentry for Next.js SSR, Datadog RUM, or Vercel built-in observability) and different PII rules because the server-side dashboard handles more PII than the mobile app. Conflating them delays both. Deferred work: dashboard error/crash reporting is captured as a separate later ProdFAQ pass under a new topic (`Topic:Dashboard-Observability` or merged into dashboard item #17 resolution), tracking server-route exceptions, client-side React errors, API-route 5xx rate, Firestore/PG query failures, robot API auth anomalies. Not blocked by this rollout; can run in parallel under a different owner. Shared policy: PII/sanitized-error rules established in Q-MCR-004 + Q-MEH ruleset are the baseline for the future dashboard observability topic; do not re-litigate PII handling when that topic opens — point to Q-MCR-004.
**Confidence:** CONFIRMED
**Source:** `Supervolcano Production Readiness Report v2.md` item #5 placement; `CLAUDE.md` monorepo architecture; PB interactive session 2026-04-24 (accepted skill recommendation)

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
  category: 'upload' | 'camera' | 'mode-switch' | 'permission' | 'recording' | 'auth' | 'network';
  action?: string;
  metadata?: Record<string, string | number | boolean>;
};

export function logError(error: unknown, context: LogErrorContext): void;
```

Behavior: (1) Normalize `error` to `Error` — wrap strings/unknowns in `new Error(String(error))`. (2) Strip PII from `metadata` via a small allowlist (per Q-MCR-004 custom-keys allow list); reject keys not on the allowlist with a dev-only warning. (3) `crashlytics().setAttribute('last_error_category', context.category)` + `setAttribute('last_error_action', context.action ?? '')`. (4) For each metadata entry, `crashlytics().setAttribute(key, String(value))` only if the key is on the allowlist. (5) `crashlytics().log(\`err: ${context.category}/${context.action ?? 'n/a'}\`)` breadcrumb. (6) `crashlytics().recordError(normalizedError)`. (7) In `__DEV__`, also `console.warn('[logError]', context, error)` for local visibility; in production builds, no console output — stays silent per Q-MEH-004.

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

## Topic: Offline Recording Mode

_No topic-scoped questions captured yet._

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
