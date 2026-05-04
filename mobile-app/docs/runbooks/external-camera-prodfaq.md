# External Camera ProdFAQ

_Last updated: 2026-05-02 (PB session: 3 BLOCKING items resolved — Q-PROJ-008, Q-CONN-005, Q-PREV-002)_

_Greenfield seed scoped to the external USB camera feature on `mobile-app/`. Inputs: existing JS state machine + components + hooks (`src/native/external-camera.ts`, `src/hooks/useExternalCameraDiagnostics.ts`, `src/components/external-camera/*`), screen consumer `src/screens/CameraScreen.tsx`, plan doc `docs/runbooks/external-cam-plan.md`, Maestro sim `.maestro/external-camera-simulation.yaml`, and approved native module plan `~/.claude/plans/do-you-have-any-vectorized-music.md`. Answers tagged `CONFIRMED` are read straight from committed code or PB sessions; `INFERRED` is best-fit interpretation; `UNKNOWN` flags genuine gaps for PB review._

---

## Project-Wide Questions

### Q-PROJ-001: Which devices support external USB cameras?

**Scope:** Project-Wide
**Category:** TA / UX
**Priority:** BLOCKING
**Question:** Which Android device classes are supported targets, and is iOS support intended in v1 or out of scope?
**Answer:** Android-only. JS guard at `src/native/external-camera.ts:143` is `Platform.OS === 'android' && !!NativeExternalCameraModule`. iOS path returns stub-disconnected status (`getStatus()` lines 154-174). USB host capability required (`hasUsbHostFeature` field).
**Confidence:** CONFIRMED
**Source:** src/native/external-camera.ts:143; src/native/external-camera.ts:154-174

### Q-PROJ-002: What is the camera backend strategy?

**Scope:** Project-Wide
**Category:** TA
**Priority:** BLOCKING
**Question:** Does the app use Camera2/CameraX with `LENS_FACING_EXTERNAL`, a UVC pipeline via libuvccamera, or both?
**Answer:** UVC-only via `libuvccamera` (saki-iwd 9.1.0). Camera2 path explicitly out of scope per approved native plan. Status field `backend` reports `'uvc'` when active. Decision driven by need to support cameras not exposed via Camera2.
**Confidence:** CONFIRMED
**Source:** ~/.claude/plans/do-you-have-any-vectorized-music.md (approved 2026-05-02); src/native/external-camera.ts:48

### Q-PROJ-003: Is audio recorded with the external camera?

**Scope:** Project-Wide
**Category:** BL / UX
**Priority:** BLOCKING
**Question:** Does external-camera recording capture audio (phone mic muxed into MP4), or video-only?
**Answer:** Video-only in MVP. JS contract accepts `enableAudio` option (`src/native/external-camera.ts:106`) but native side ignores it in Phase 3 recording. Plan doc `Permissions` section: "remove microphone permission if audio is fully disabled".
**Confidence:** CONFIRMED
**Source:** docs/runbooks/external-cam-plan.md:82-83; ~/.claude/plans/do-you-have-any-vectorized-music.md

### Q-PROJ-004: Where does external recording output land?

**Scope:** Project-Wide
**Category:** TA / BL
**Priority:** BLOCKING
**Question:** Does the external camera write MP4 segments through the same upload queue as native recording?
**Answer:** Yes. `CameraScreen.tsx:564` confirms segments emitted via `onRecordingStateChanged{state:'finalized', filePath}` flow into the existing upload queue (`useUploadQueue`, hook visible in `CameraScreen.tsx:124`). Footer shows "Saved to upload queue." after finalize (`external-camera-display.ts:97`).
**Confidence:** CONFIRMED
**Source:** src/screens/CameraScreen.tsx:124,564; src/components/external-camera/external-camera-display.ts:97

### Q-PROJ-005: How is the segment cadence handled for external recording?

**Scope:** Project-Wide
**Category:** BL
**Priority:** BLOCKING
**Question:** What segment duration applies to external-camera recording, and how are segment boundaries enforced?
**Answer:** 5 minutes per segment (`SEGMENT_DURATION = 300` seconds, `CameraScreen.tsx:50`). JS-side `setTimeout` triggers `ExternalCamera.stopRecording()` at boundary (`CameraScreen.tsx:546-548, 549, 708`). Same segmentation cadence as native path.
**Confidence:** CONFIRMED
**Source:** src/screens/CameraScreen.tsx:50,546-549,708

### Q-PROJ-006: What permissions does the app request, and when?

**Scope:** Project-Wide
**Category:** BL / UX
**Priority:** BLOCKING
**Question:** What is the permission acquisition order — Android camera permission, USB host feature, USB device permission?
**Answer:** Three gates checked in this order by `ExternalCameraController.refreshStatus()`: (1) `PackageManager.FEATURE_USB_HOST` → `usb_host_unsupported` if missing; (2) `Manifest.permission.CAMERA` → `camera_permission_required` if not granted; (3) per-device USB permission via `UsbManager.requestPermission` → `usb_permission_required` until granted. Only after all three does state advance to `Ready`.
**Confidence:** CONFIRMED
**Source:** modules/external-camera/android/src/main/java/com/supervolcano/externalcamera/ExternalCameraController.kt:refreshStatus

### Q-PROJ-007: How does the external module coexist with `react-native-vision-camera`?

**Scope:** Project-Wide
**Category:** TA / UX
**Priority:** BLOCKING
**Question:** Two camera consumers cannot hold the device simultaneously — how is teardown sequenced when toggling modes?
**Answer:** JS-side mode switch in `CameraScreen.tsx:891-979` enforces serialization. When switching to external: `setCameraMode('external')` first, then `setExternalModeEnabled(true)`. When switching to native: `setNativeCameraMountKey++` remounts the vision-camera `Camera` component while disabling external mode. Vision-camera `<Camera isActive={isNativeCameraActive}/>` (`CameraScreen.tsx:1267`) gates capture by mode. Mode-switch is disabled during active session/recording/transition (`CameraScreen.tsx:893-898`).
**Confidence:** CONFIRMED
**Source:** src/screens/CameraScreen.tsx:891-979,1267

### Q-PROJ-008: Is the external camera surfaced on every recording screen?

**Scope:** Project-Wide
**Category:** UX
**Priority:** BLOCKING
**Question:** Is the toggle available on `CameraScreen`, `MemberRecordScreen`, AND the cleaner navigator's recording screen?
**Answer:** All three. Toggle must be wired into the cleaner recording flow as well — currently only confirmed in `CameraScreen.tsx:38-44` and `MemberRecordScreen.tsx:38-40`. Cleaner recording screen needs the same `useExternalCameraDiagnostics` + `CameraModeToggle` + `ExternalCameraView` wiring as the other two.
**Confidence:** CONFIRMED
**Source:** PB interactive session 2026-05-02

---

## Topic: Toggle Visibility & Gating

### Q-TOGGLE-001: When does the camera mode toggle render?

**Scope:** Topic:Toggle
**Category:** UX / BL
**Priority:** BLOCKING
**Question:** Under what conditions is `CameraModeToggle` rendered to the user?
**Answer:** Renders only when `showExternalToggle === true`, which equals `externalCamera.isSupported` (i.e., `Platform.OS==='android' && NativeModules.ExternalCameraModule` is registered). Hidden on iOS, hidden when native module missing, hidden in builds without the module. `CameraScreen.tsx:82, 1320`.
**Confidence:** CONFIRMED
**Source:** src/screens/CameraScreen.tsx:82,1320

### Q-TOGGLE-002: When is the External option in the toggle disabled (greyed)?

**Scope:** Topic:Toggle
**Category:** UX / BL
**Priority:** BLOCKING
**Question:** What conditions disable the External tab while still showing the toggle?
**Answer:** Disabled when `!externalCamera.canSwitchToExternal`. `canSwitchToExternal === isSupported` (always true once toggle is visible). Effective disable is on the entire toggle (both options) when `isModeTransitioning || isSessionActive || isRecording` (`CameraScreen.tsx:1326`). External-specific disable is currently never triggered in code.
**Confidence:** CONFIRMED
**Source:** src/screens/CameraScreen.tsx:1325-1327; src/hooks/useExternalCameraDiagnostics.ts:188

### Q-TOGGLE-003: Is the toggle hidden if no USB camera is attached, or always visible?

**Scope:** Topic:Toggle
**Category:** UX
**Priority:** BLOCKING
**Question:** Should users see the toggle even with no USB device attached, or only after attach?
**Answer:** Toggle is visible whenever module is supported, regardless of attach state. Tapping External when nothing is attached transitions UI into `ExternalCameraPanel` with diagnostics card showing "USB video device: Not detected". Mode switch will time out after 15s if no device appears (`MODE_SWITCH_TIMEOUT_MS=15000`, `CameraScreen.tsx:51`).
**Confidence:** CONFIRMED
**Source:** src/screens/CameraScreen.tsx:51,82,1320; src/components/external-camera/ExternalCameraPanel.tsx:181-185

---

## Topic: Mode Switching UX

### Q-SWITCH-001: How long does the user wait when switching to external mode?

**Scope:** Topic:Switching
**Category:** UX / TA
**Priority:** BLOCKING
**Question:** What is the timeout before a stuck mode-switch falls back to native, and is there a manual cancel?
**Answer:** Hard timeout 15 seconds (`MODE_SWITCH_TIMEOUT_MS=15000`). After 5 seconds (`MODE_SWITCH_CANCEL_REVEAL_MS=5000`) a Cancel affordance reveals (`isCancelAvailable` state). On timeout, alert shows "Couldn't switch camera. Try again or check your camera connection." with Cancel + Try again actions. Failure reverts to previous mode and re-enables vision-camera (`CameraScreen.tsx:910-926`).
**Confidence:** CONFIRMED
**Source:** src/screens/CameraScreen.tsx:51-52,906-926

### Q-SWITCH-002: Footer message during mode switch?

**Scope:** Topic:Switching
**Category:** UX
**Priority:** CLARIFYING
**Question:** What text is shown to the user during the mode-switch transition?
**Answer:** "Switching camera..." (`external-camera-display.ts:91`), with `connectionLabel: "Switching"` and `showSpinner: true`.
**Confidence:** CONFIRMED
**Source:** src/components/external-camera/external-camera-display.ts:91,109,160

### Q-SWITCH-003: Can mode be changed while a recording session is active?

**Scope:** Topic:Switching
**Category:** BL / UX
**Priority:** BLOCKING
**Question:** Is mode switching gated when recording, sessioned, or transitioning?
**Answer:** Yes — `handleCameraModeChange` (`CameraScreen.tsx:891-898`) returns early if `mode === cameraMode || isModeTransitioning || isSessionActive || isRecording`. The `CameraModeToggle` `disabled` prop also reflects this. Switching requires ending the session first.
**Confidence:** CONFIRMED
**Source:** src/screens/CameraScreen.tsx:891-898,1326

---

## Topic: Connection Lifecycle

### Q-CONN-001: What are the user-visible connection states?

**Scope:** Topic:Connection
**Category:** UX
**Priority:** BLOCKING
**Question:** What labels does the diagnostics panel surface for connection state?
**Answer:** `Switching` / `Finishing` / `Recording` / `Connected` / `Unavailable` / `App permission needed` / `USB permission needed` / `Unsupported` / `USB host unavailable` / `Not detected` / `Queued` / `Connecting` / `Preparing` / `Checking`. Mapping in `external-camera-display.ts:108-146`.
**Confidence:** CONFIRMED
**Source:** src/components/external-camera/external-camera-display.ts:108-146

### Q-CONN-002: When does the spinner appear?

**Scope:** Topic:Connection
**Category:** UX
**Priority:** CLARIFYING
**Question:** Under what status combinations is a loading spinner shown?
**Answer:** `showSpinner = isModeTransitioning || isFinishingRecording || isOpening` where `isOpening` is true when the camera is initializing without an active preview, error, or permission gate (`external-camera-display.ts:80-87,160`).
**Confidence:** CONFIRMED
**Source:** src/components/external-camera/external-camera-display.ts:80-87,160

### Q-CONN-003: When is the Retry action shown?

**Scope:** Topic:Connection
**Category:** UX / BL
**Priority:** CLARIFYING
**Question:** Under what conditions does the Retry button appear in the diagnostics panel?
**Answer:** `showRetryAction = hasStableError && !hasActivePreview && !isFinishingRecording` (`external-camera-display.ts:161`). Retry calls `externalCamera.retryPreview()` → native `retryPreview()` which re-attempts USB enumeration + UVC connect.
**Confidence:** CONFIRMED
**Source:** src/components/external-camera/external-camera-display.ts:161; src/hooks/useExternalCameraDiagnostics.ts:228-235

### Q-CONN-004: How long does the hook wait for `sessionState` transitions?

**Scope:** Topic:Connection
**Category:** TA
**Priority:** CLARIFYING
**Question:** What timeout governs `waitForSessionState`?
**Answer:** Default 1500 ms (`useExternalCameraDiagnostics.ts:257`). After timeout, `isConnectionTimedOut` flag set to true; consumer can call `resetConnectionTimeout()` to retry.
**Confidence:** CONFIRMED
**Source:** src/hooks/useExternalCameraDiagnostics.ts:253-297

### Q-CONN-005: Can the preview survive USB detach mid-recording?

**Scope:** Topic:Connection
**Category:** BL / TA / UX
**Priority:** BLOCKING
**Question:** What happens to an active recording when the USB cable is pulled?
**Answer:** Native side finalizes the truncated MP4 cleanly (MediaMuxer stop → playable file). On finalize, the file is routed to the **offline-recordings flow UI** rather than the standard auto-upload path, so the user can decide whether to upload the partial segment or discard it. `onUsbDetached` + `onCameraError` events fire so the UI hides the toggle and shows "Unavailable". JS-side segment finalize handler must distinguish truncated/partial finalization (carry a flag in the `RecordingStateEvent` payload, e.g., `partial: true`) and route to the offline-recordings screen instead of the normal upload queue.
**Confidence:** CONFIRMED
**Source:** PB interactive session 2026-05-02

---

## Topic: Permissions UX

### Q-PERM-001: How is USB device permission requested?

**Scope:** Topic:Permissions
**Category:** UX / TA
**Priority:** BLOCKING
**Question:** When does the system USB permission dialog appear, and what triggers it?
**Answer:** Triggered by `setExternalModeEnabled(true)` when a UVC device is attached without permission, or by the `USB_DEVICE_ATTACHED` system intent matching the manifest filter (`@xml/usb_device_filter`). System shows a stock Android dialog naming the vendor/product. Result delivered via `onUsbPermissionResult{granted}` event.
**Confidence:** CONFIRMED
**Source:** modules/external-camera/android/src/main/java/com/supervolcano/externalcamera/UsbDeviceMonitor.kt:requestPermission; modules/external-camera/app.plugin.js

### Q-PERM-002: What does the panel show when camera permission is denied?

**Scope:** Topic:Permissions
**Category:** UX
**Priority:** BLOCKING
**Question:** Does the panel link to system settings when Android camera permission is denied?
**Answer:** Yes. `ExternalCameraPanel` shows "Open settings" action when `cameraPermissionStatus === 'denied'`, calling `Linking.openSettings()` via `externalCamera.openSettings`.
**Confidence:** CONFIRMED
**Source:** src/components/external-camera/ExternalCameraPanel.tsx:154-179; src/hooks/useExternalCameraDiagnostics.ts:200-202

### Q-PERM-003: What happens if the user denies USB permission?

**Scope:** Topic:Permissions
**Category:** UX / BL
**Priority:** BLOCKING
**Question:** Does the app re-prompt, fall back, or show a hard error?
**Answer:** Native alert: "USB permission denied — Allow access to the USB camera to use external recording." (`useExternalCameraDiagnostics.ts:319-323`). Status updates to `usb_permission_required`. User must replug or tap Retry to re-prompt.
**Confidence:** CONFIRMED
**Source:** src/hooks/useExternalCameraDiagnostics.ts:319-331

---

## Topic: Recording Pipeline

### Q-REC-001: What recording quality is requested?

**Scope:** Topic:Recording
**Category:** TA / BL
**Priority:** BLOCKING
**Question:** What quality is passed to `startRecording`, and how is it negotiated against UVC capabilities?
**Answer:** Caller passes `'highest' | 'fhd' | 'hd' | 'sd'`. Native side calls `ProfileNegotiator` which walks `[1280×720 MJPEG, 640×480 MJPEG, 640×480 YUYV]` for UVC devices; first success wins. `capQualityToProfile` in `external-camera.ts:127-135` caps the requested quality at the negotiated profile (e.g., requesting `fhd` on a 720p UVC cam gets capped to `hd`).
**Confidence:** CONFIRMED
**Source:** src/native/external-camera.ts:120-135; ~/.claude/plans/do-you-have-any-vectorized-music.md ProfileNegotiator

### Q-REC-002: What container/codec is the output MP4?

**Scope:** Topic:Recording
**Category:** TA
**Priority:** BLOCKING
**Question:** What encoder produces the recording, and what container?
**Answer:** Android `MediaCodec` H.264 encoder + `MediaMuxer` MP4 container. Video-only track (no audio in MVP). Implementation in `UvcMp4Recorder.kt` per Phase 3 of approved plan.
**Confidence:** CONFIRMED
**Source:** ~/.claude/plans/do-you-have-any-vectorized-music.md UvcMp4Recorder

### Q-REC-003: What is the recording UI footer text?

**Scope:** Topic:Recording
**Category:** UX
**Priority:** CLARIFYING
**Question:** What does the user see in the diagnostics footer during recording?
**Answer:** "Recording from external camera..." (`external-camera-display.ts:99-100`). Connection label: "Recording". Status pill icon: pass.
**Confidence:** CONFIRMED
**Source:** src/components/external-camera/external-camera-display.ts:99-100,115-117

### Q-REC-004: What footer text appears while finalizing?

**Scope:** Topic:Recording
**Category:** UX
**Priority:** CLARIFYING
**Question:** What is shown after stop is tapped but before the MP4 is queued?
**Answer:** "Finishing external recording and saving it to the upload queue..." (`external-camera-display.ts:93-95`). After queue add: "Saved to upload queue." Connection label transitions Finishing → Queued.
**Confidence:** CONFIRMED
**Source:** src/components/external-camera/external-camera-display.ts:93-98,112-114

### Q-REC-005: Does external recording produce thumbnails?

**Scope:** Topic:Recording
**Category:** TA / UX
**Priority:** CLARIFYING
**Question:** Does the upload queue generate thumbnails from external-camera MP4s, same as native?
**Answer:** Unanswered — needs verification of upload-queue thumbnail logic (likely in `useUploadQueue` hook + segment processor). If native path generates via vision-camera frame extraction, external path may need its own thumbnail step using `MediaMetadataRetriever`.
**Confidence:** UNKNOWN
**Source:** Not derivable from external-camera scope alone

---

## Topic: Error & Recovery

### Q-ERR-001: What error states does the user see?

**Scope:** Topic:Errors
**Category:** UX
**Priority:** BLOCKING
**Question:** Catalog of error footer messages and their triggers?
**Answer:** (a) `temporarily_unavailable`: "External camera is temporarily unavailable. Reconnect the USB camera and try again." (`useExternalCameraDiagnostics.ts:67-69`). (b) `usb_attached_not_supported`: "USB camera detected, but no usable UVC camera is ready yet." (c) `usb_host_unsupported`: "This device does not support USB host mode." (d) Mode-switch timeout: "Couldn't switch camera. Try again or check your camera connection." (CameraScreen.tsx alert). (e) Stable error during preview: connection label "Unavailable" + Retry button.
**Confidence:** CONFIRMED
**Source:** src/hooks/useExternalCameraDiagnostics.ts:67-156; src/components/external-camera/external-camera-display.ts:122-138

### Q-ERR-002: How does the user recover from a stable error?

**Scope:** Topic:Errors
**Category:** UX / BL
**Priority:** BLOCKING
**Question:** What manual recovery affordances exist?
**Answer:** (a) Retry button in diagnostics panel calls `retryPreview()`. (b) Detach + reattach USB cable triggers full re-detection. (c) Switching to Native mode and back. (d) For permission errors: Open Settings link.
**Confidence:** CONFIRMED
**Source:** src/components/external-camera/ExternalCameraPanel.tsx:177-192; src/hooks/useExternalCameraDiagnostics.ts:228-235

### Q-ERR-003: Are errors logged to telemetry?

**Scope:** Topic:Errors
**Category:** TA
**Priority:** CLARIFYING
**Question:** Is `attemptedProfiles` / `lastFailureReason` reported anywhere beyond the in-app diagnostics?
**Answer:** Unanswered — need PB decision on whether to forward to Firebase Crashlytics, Sentry, or app-internal telemetry. `attemptedProfiles[]` array is populated by native side but currently only consumed by JS for in-panel display.
**Confidence:** UNKNOWN
**Source:** Not derivable from current code

---

## Topic: Diagnostics Panel

### Q-DIAG-001: What checks does the diagnostics card show?

**Scope:** Topic:Diagnostics
**Category:** UX
**Priority:** CLARIFYING
**Question:** What rows are in the "External camera checks" card?
**Answer:** Three rows: (1) Camera permission [Granted/Not granted/Checking, with Open settings action]. (2) USB video device [Detected/Not detected]. (3) External camera detected [pass/fail/pending, with Retry action when stable error].
**Confidence:** CONFIRMED
**Source:** src/components/external-camera/ExternalCameraPanel.tsx:170-194

### Q-DIAG-002: When is the simulation harness visible?

**Scope:** Topic:Diagnostics
**Category:** UX / TA
**Priority:** CLARIFYING
**Question:** When does the "Debug simulation" card appear with mock state buttons?
**Answer:** Only in dev builds: `__DEV__ && isSupported` (`useExternalCameraDiagnostics.ts:394-402`). Six mock-state buttons: Disconnected, Camera perm, Unavailable, USB perm, Unsupported, Ready, plus Live device clear. Maestro flow exercises these buttons (`.maestro/external-camera-simulation.yaml`).
**Confidence:** CONFIRMED
**Source:** src/hooks/useExternalCameraDiagnostics.ts:394-402; src/components/external-camera/ExternalCameraPanel.tsx:196-231

### Q-DIAG-003: Does the live preview replace the placeholder when ready?

**Scope:** Topic:Diagnostics
**Category:** UX
**Priority:** BLOCKING
**Question:** When does the live UVC preview render in place of the static placeholder?
**Answer:** When `!externalCamera.isSimulated` AND `externalDisplay.showPreviewPlaceholder === false`, `<ExternalCameraView>` mounts inside the panel's `previewContainer` (`CameraScreen.tsx:1247-1253`; panel `preview` prop). Placeholder shows otherwise (`ExternalCameraPanel.tsx:160-167`).
**Confidence:** CONFIRMED
**Source:** src/screens/CameraScreen.tsx:1247-1253; src/components/external-camera/ExternalCameraPanel.tsx:160-167

---

## Topic: Preview Surface

### Q-PREV-001: How does the preview view fit the screen?

**Scope:** Topic:Preview
**Category:** UX
**Priority:** BLOCKING
**Question:** Does the UVC preview fill the screen edge-to-edge or letterbox?
**Answer:** Edge-to-edge fill. Plan doc §"Preview Fit": "Use `PreviewView.ScaleType.FILL_CENTER` by default. Make sure the Preview will be able to fill the screen edge to edge." JS mounts `<ExternalCameraView style={StyleSheet.absoluteFill}/>` (`CameraScreen.tsx:1249-1251`).
**Confidence:** CONFIRMED
**Source:** docs/runbooks/external-cam-plan.md:54,76-77; src/screens/CameraScreen.tsx:1249-1251

### Q-PREV-002: Does preview support landscape orientation?

**Scope:** Topic:Preview
**Category:** UX / TA
**Priority:** BLOCKING
**Question:** Phone is locked portrait — how is the UVC camera's native landscape framing displayed?
**Answer:** Phone stays in portrait (existing `MainActivity` `screenOrientation:"portrait"` is preserved — no per-mode unlock). UVC preview renders in its native landscape orientation, **letterboxed** in the middle of the portrait viewport with black bars top + bottom. Use `ScaleType.FIT_CENTER` (NOT `FILL_CENTER`). Recording captures the full landscape frame as the UVC device delivers it; no software rotation. Plan doc line 76-77 lists both `FIT_CENTER` and `FILL_CENTER` as options — picking FIT_CENTER per PB.
**Confidence:** CONFIRMED
**Source:** PB interactive session 2026-05-02

### Q-PREV-003: What event signals preview is live?

**Scope:** Topic:Preview
**Category:** TA / UX
**Priority:** CLARIFYING
**Question:** How does the JS side know when frames are flowing?
**Answer:** Native view emits `onPreviewReadyChange({ready: boolean})` on first frame and on teardown (`ExternalCameraView.tsx:11-13, 33-37`). Consumer handles via prop callback. Module-level `onExternalCameraStatusChanged` also reflects via `sessionState='ready'` and `connectionPhase='ready'`.
**Confidence:** CONFIRMED
**Source:** src/components/external-camera/ExternalCameraView.tsx:11-37; src/native/external-camera.ts:18-21

---

## Topic: Test Strategy

### Q-TEST-001: Is there an automated test for the external-camera flow?

**Scope:** Topic:Testing
**Category:** TA
**Priority:** CLARIFYING
**Question:** What end-to-end test exists for the toggle + connect + record flow?
**Answer:** Maestro flow at `.maestro/external-camera-simulation.yaml` exercises debug builds via the simulation harness — taps mock state buttons in sequence and asserts text/IDs. Does NOT exercise real UVC device. No unit tests for native module currently.
**Confidence:** CONFIRMED
**Source:** mobile-app/.maestro/external-camera-simulation.yaml

### Q-TEST-002: Required physical-device test matrix?

**Scope:** Topic:Testing
**Category:** TA
**Priority:** CLARIFYING
**Question:** Which Android devices + USB cameras must be tested before shipping?
**Answer:** Unanswered — needs PB to specify target tablet model(s) and UVC camera SKU(s). Plan doc §Risks notes "Cap UVC path at 720p in `ProfileNegotiator` if telemetry shows drops" — implies real-device profiling needed.
**Confidence:** UNKNOWN
**Source:** ~/.claude/plans/do-you-have-any-vectorized-music.md Open Questions

---

## Questions Awaiting Your Input

_(Edit answers in place; bring this file back for re-merge if structure changes. Recommended answers tagged INFERRED — accept by leaving as-is, override by replacing the answer text, or delete the Answer line to leave unanswered.)_

### Q-REC-005: Does external recording produce thumbnails?

**Scope:** Topic:Recording
**Category:** TA / UX
**Priority:** CLARIFYING
**Question:** Does the upload queue generate thumbnails from external-camera MP4s, same as native?
**Answer (INFERRED recommendation — edit or accept):** Same thumbnail step as native — extract first keyframe via `MediaMetadataRetriever` after MP4 finalize, before queue add. JS-side, in the segment finalize handler.
**Basis:** standard upload-queue convention + parity with native path.

### Q-ERR-003: Are errors logged to telemetry?

**Scope:** Topic:Errors
**Category:** TA
**Priority:** CLARIFYING
**Question:** Forward `attemptedProfiles` / `lastFailureReason` to telemetry, or in-app diagnostics only?
**Answer (INFERRED recommendation — edit or accept):** In-app diagnostics only for v1; revisit after first deployment. Adding telemetry forwarding before real-device data exists wastes effort tuning what isn't being seen yet.
**Basis:** approved plan §Open Questions explicitly leaves this open; YAGNI for first ship.

### Q-TEST-002: Required physical-device test matrix?

**Scope:** Topic:Testing
**Category:** TA
**Priority:** CLARIFYING
**Question:** Which Android devices + USB cameras must be tested before shipping?
**Answer (INFERRED recommendation — edit or accept):** Test matrix = (1) one ruggedized Android tablet running Android 13+ with USB-C OTG, (2) one entry-level webcam (Logitech C270 / similar UVC class 1.0), (3) one higher-end webcam (Logitech C920 / Brio). Capture profile-negotiator output on each.
**Basis:** common matrix for UVC OTG validation + plan §Risks reference to telemetry-driven cap decisions.
