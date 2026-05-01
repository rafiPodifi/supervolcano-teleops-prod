# Feature 7 Implementation Checklist: Camera Mode-Switch Hang Fix

_Last updated: 2026-04-23_

## Goal

Address mobile issue `#7` from `Supervolcano Production Readiness Report v2.md`:

> Mode-switch during recording can hang indefinitely. When switching camera modes while recording, the app can wait forever for the camera with no feedback to the worker and no way to recover.

Code area: `mobile-app/src/screens/member/MemberRecordScreen.tsx :395–433`.

This checklist is based on the confirmed `Topic:Mobile-Camera-Mode-Switch` decisions in `docs/supervolcano-prodfaq.md` (Q-MCMS-001 through Q-MCMS-007).

## Product Rules to Enforce

- [x] Camera mode switching is not allowed while recording is active (Q-MCMS-001).
- [x] Mode toggle controls are disabled or hidden during recording (Q-MCMS-001).
- [x] Mode-switch operation has a 15-second timeout before it is considered failed (Q-MCMS-002).
- [x] During an idle-state mode-switch, a blocking overlay appears with the label `Switching camera...` (Q-MCMS-003).
- [x] Record and Exit controls are disabled while the transition overlay is visible (Q-MCMS-003).
- [x] A Cancel action appears in the overlay after 5 seconds so the worker can escape an unresponsive camera (Q-MCMS-003, Q-MCMS-005).
- [x] No raw diagnostics or exception text are shown on screen during transition or failure (Q-MCMS-003, Q-MEH-004).
- [x] On 15-second timeout, the app automatically reverts to the previous camera mode (Q-MCMS-004).
- [x] On timeout, the app shows a friendly `Recording unavailable` category message such as `Couldn't switch camera. Try again or check your camera connection.` (Q-MCMS-004).
- [x] On target-mode initialization failure, the app automatically reverts to the previous camera mode and shows a friendly message (Q-MCMS-006).
- [x] The worker is never stranded on the broken target mode (Q-MCMS-006).
- [x] A `Try again` action is available in any failure message and re-invokes the mode-switch without leaving the record screen (Q-MCMS-007).
- [x] Cancel silently reverts to the previous mode without showing a failure alert.

## Implementation Work

### Dead-code removal (consequence of Q-MCMS-001)

- [x] Remove the in-recording branch of `handleCameraModeChange`: no more `wasRecording`, no more `stopRecording(false)` inside the handler, no more `shouldResumeRecordingRef` flag.
- [x] Remove the `useEffect` that watches `shouldResumeRecordingRef` and auto-resumes recording.
- [x] Remove the `shouldResumeRecordingRef` ref declaration.

### Disable mode toggle during recording (Q-MCMS-001)

- [x] Pass `disabled={isModeTransitioning || isRecording}` to the `CameraModeToggle` instance in `MemberRecordScreen`.

### Mode-switch lifecycle state

- [x] Track the target mode for the in-flight transition so `Try again` and revert know what was attempted.
- [x] Track the previous mode so revert restores it cleanly.
- [x] Add state `isCancelAvailable` that becomes true 5 seconds into a transition.
- [x] Add timers: one for the 15-second timeout, one for the 5-second Cancel reveal.
- [x] Ensure timers are cleared on unmount, on success, on failure, on cancel.

### Completion detection

- [x] For a switch to `native`: consider the transition complete as soon as the native camera is mounted (use the existing `nativeCameraMountKey` bump plus `isNativeCameraActive`).
- [x] For a switch to `external`: consider the transition complete when `externalCamera.isReady` becomes true.
- [x] If `ExternalCamera.setExternalModeEnabled` rejects, treat it as a target-mode init failure.

### Failure handling (Q-MCMS-004, Q-MCMS-006, Q-MCMS-007)

- [x] On timeout or init failure, clear timers, revert to the previous camera mode, re-call `ExternalCamera.setExternalModeEnabled` with the previous mode's value.
- [x] Use the existing `getFriendlyErrorCopy(error, 'recording')` helper to derive the friendly `Recording unavailable` copy.
- [x] Show the friendly message via `Alert.alert` with two actions: `OK` (dismiss) and `Try again` (re-invoke mode change against the same target).
- [x] Never surface raw error text in the alert; keep raw text in `console.warn` / logs only.

### Cancel path (Q-MCMS-005)

- [x] When the worker taps Cancel in the overlay, clear timers, revert to the previous mode silently, and return the screen to idle. Do not show an alert.

### Transition overlay UI (Q-MCMS-003)

- [x] Render a blocking overlay on top of the record screen while `isModeTransitioning` is true.
- [x] Overlay shows a spinner + `Switching camera...` label.
- [x] Overlay intercepts touches so Record and Exit cannot be tapped while visible.
- [x] After 5 seconds, overlay reveals a Cancel button.

### Cleanup

- [x] Clear mode-switch timers in the component-unmount cleanup path.

## Validation

- [ ] While recording, confirm the Native/External toggle is visibly disabled and tapping does nothing.
- [ ] Idle-state switch from Native → External on a healthy USB camera completes within a few seconds, overlay disappears, recording screen returns to normal.
- [ ] Idle-state switch from External → Native completes immediately, overlay disappears.
- [ ] With no USB camera attached, Native → External surfaces the Cancel button at 5s; tapping Cancel reverts to Native with no alert.
- [ ] With an unresponsive USB camera, Native → External hits the 15-second timeout, auto-reverts to Native, shows the `Recording unavailable` alert, and `Try again` re-runs the attempt.
- [ ] If the USB camera is unplugged mid-transition, the app reverts to Native and shows the friendly message.
- [ ] Confirm no raw error text is shown on screen during any failure path.
- [ ] Confirm Record and Exit buttons cannot be triggered while the overlay is visible.
