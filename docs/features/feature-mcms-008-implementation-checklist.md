# Feature MCMS-008 Implementation Checklist: Block Mode-Switch During Recording (Generic/Offline Flow)

_Last updated: 2026-04-24_

## Product Decision to Enforce

Q-MCMS-008 (Topic:Mobile-Camera-Mode-Switch): mode-switch-during-recording prohibition applies universally — both task-assigned recordings (`MemberRecordScreen`) and generic/offline recordings (`CameraScreen` with `genericRecording` param). All Q-MCMS-001..007 lifecycle rules apply identically in both flows.

## Current State

- [x] `MemberRecordScreen.tsx` — full MCMS-001..007 implementation (blocking overlay, 15s timeout, 5s Cancel reveal, auto-revert, friendly error categories, `Try again`).
- [x] `CameraScreen.tsx` (generic/offline flow) — mode switch does NOT block during active recording. `handleCameraModeChange` (line 852) stops active session to force switch; lacks 15s timeout, 5s Cancel, friendly error handling, and revert-on-failure. Toggle UI disables only on `isModeTransitioning`, not on active session.

## Gap to Close

Bring `CameraScreen.tsx` mode-switch behavior to parity with `MemberRecordScreen.tsx`.

## Android App Work

### Constants

- [x] Add `MODE_SWITCH_TIMEOUT_MS = 15000` constant in `CameraScreen.tsx`.
- [x] Add `MODE_SWITCH_CANCEL_REVEAL_MS = 5000` constant in `CameraScreen.tsx`.

### State and refs

- [x] Add `isCancelAvailable` state (default `false`).
- [x] Add `modeSwitchTimeoutRef`, `modeSwitchCancelRevealRef`, `pendingTargetModeRef`, `previousModeRef` refs.

### Callbacks

- [x] Add `clearModeSwitchTimers` to cancel both pending timeouts.
- [x] Add `endModeTransition` — clears timers, nulls pending target, resets `isCancelAvailable`, clears `isModeTransitioning`.
- [x] Add `revertToPreviousMode` — reverts `cameraMode`, remounts native camera when needed, calls `ExternalCamera.setExternalModeEnabled(previousMode === 'external')`.
- [x] Add `handleCancelModeSwitch` — reverts + ends transition when worker taps Cancel.

### Rewrite `handleCameraModeChange`

- [x] Guard: early-return when `mode === cameraMode` OR `isModeTransitioning` OR `isSessionActive` OR `isRecording`.
- [x] Remove auto-`stopSession` logic (previous behavior that killed the recording session to force switch).
- [x] Capture `previousModeRef.current = cameraMode` before switching.
- [x] Start 5s timer → set `isCancelAvailable(true)`.
- [x] Start 15s timer → revert, end transition, show `Recording unavailable` alert with `Try again` action that re-invokes `handleCameraModeChange(targetMode)`.
- [x] External path: `setCameraMode('external')`, call `ExternalCamera.setExternalModeEnabled(true)` then `externalCamera.refresh()`. On catch → revert + friendly alert via `getFriendlyErrorCopy(error, 'recording')`.
- [x] Native path: bump `nativeCameraMountKey`, `setCameraMode('native')`, `ExternalCamera.setExternalModeEnabled(false)` then `externalCamera.refresh()`. On catch → revert + friendly alert.
- [x] On .then success for native path, call `endModeTransition` (external path ends via ready-detection effect).

### Effects

- [x] Add effect: when `isModeTransitioning && pendingTargetModeRef.current === 'external' && cameraMode === 'external' && externalCamera.isReady` → `endModeTransition`.
- [x] Add unmount-cleanup effect calling `clearModeSwitchTimers`.

### UI

- [x] `CameraModeToggle` `disabled` prop: `isModeTransitioning || isSessionActive || isRecording`.
- [x] Add transition overlay (`<View style={styles.modeSwitchOverlay}>`) with `ActivityIndicator`, `Switching camera...` label, and Cancel button that appears when `isCancelAvailable`.
- [x] Reuse `getStatusMessage` pattern — return `Switching camera...` when `isModeTransitioning`.
- [x] Add `modeSwitchOverlay`, `modeSwitchLabel`, `modeSwitchCancelButton`, `modeSwitchCancelText` styles (port from `MemberRecordScreen.tsx`).

## Validation

- [ ] Start a generic recording with native camera; verify mode toggle is disabled and tapping it has no effect.
- [ ] Start a generic recording with external camera; verify mode toggle is disabled.
- [ ] Stop recording, trigger a mode-switch, yank the external cable before 15s; confirm revert + `Recording unavailable` friendly alert + `Try again`.
- [ ] Stop recording, trigger a mode-switch, wait 5s; confirm Cancel appears in overlay.
- [ ] Tap Cancel mid-transition; confirm revert to previous mode, overlay dismissed, no stuck state.
- [ ] Confirm task-assigned recording flow (`MemberRecordScreen`) unaffected — all MCMS-001..007 behavior intact.
- [ ] Confirm no regression to upload queue, generic recording persistence, or assignment flow.
