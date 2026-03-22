# Testing Playbook

## Strategy

Use a layered test plan:

1. Maestro for black-box Android user flows.
2. Kotlin unit or instrumented tests for native logic and edge cases.
3. Physical-device validation for USB camera, recording, and upload recovery behavior.

## Default E2E Choice

Use Maestro first because it works well with:

- React Native screens
- Android permission dialogs
- Native camera surfaces
- Flows that cross JS and Kotlin boundaries

Choose Detox only if the project needs stronger synchronization with app state and is willing to pay the setup cost.

## Minimum E2E Requirements

- Add stable `testID` values on critical controls and status text.
- Ensure the app can launch into a deterministic state for recording and upload flows.
- Separate black-box UI validation from hardware diagnostics; do not expect E2E scripts to prove every CameraX detail.

## High-Value Android Scenarios

### Permissions and mode switching

- Launch app with denied permissions and verify the blocked state.
- Grant camera and microphone permissions and verify transition to ready state.
- Switch between built-in and external camera modes.

### External camera lifecycle

- Connect USB camera and verify attach signal reaches the UI.
- Confirm permission request and granted-state handling.
- Verify preview appears without stretch.
- Disconnect the device and verify the screen falls back gracefully.

### Recording lifecycle

- Start recording from external mode.
- Stop recording and verify finalized state, file path handling, and UI reset.
- Rotate device if supported and verify target rotation stays correct.

### Upload resilience

- Start upload, disable network, and verify retry or queued state.
- Restore network and verify recovery.
- Relaunch app and confirm persistent jobs resume if the implementation claims restart safety.

## Native Test Targets

Add Kotlin unit or instrumented tests around logic such as:

- camera selection fallback
- quality or resolution mapping
- aspect-ratio decision helpers
- USB permission bookkeeping
- upload queue persistence and retry policy

Keep UI assertions out of these tests unless the behavior is truly native-view specific.

## Hardware Matrix

Prefer at least:

- one physical Android phone with the target OS version
- one USB OTG setup
- one known-good external camera
- one poor-network scenario

State the exact hardware and OS used in validation notes. If a task cannot be fully verified without hardware you do not have, say that explicitly.

## Evidence To Report

When finishing work, report:

- what was tested
- what environment was used
- what remains unverified
- whether the remaining risk is in UI, native camera behavior, or backend transport
