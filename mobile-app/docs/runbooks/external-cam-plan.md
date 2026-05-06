# External Camera Plan (Android CameraX + React Native)

This plan documents integrating an external USB/OTG UVC camera using CameraX/Camera2,
with a React Native UI toggle between built-in and external cameras.

## Goals
- Support UVC OTG external cameras on Android.
- Use CameraX/Camera2 for preview + recording.
- Provide a React Native toggle between built-in and external cameras.
- Maintain existing segmentation + upload queue flow.
- Handle portrait and landscape without manual view sizing.

## Assumptions
- App is shipped as a release APK built with local Gradle.
- Expo Go is not used.
- External camera is UVC-compliant and appears as Camera2 external camera
  (`LENS_FACING_EXTERNAL`). If not, a UVC pipeline is required.
- No microphone audio needed for external camera recording.

## High-Level Approach
- Keep UI in React Native.
- Implement a native Android module using CameraX:
  - `ExternalCameraView` for preview (CameraX `PreviewView`).
  - `ExternalCameraModule` for commands (enumerate, set active, start/stop).
  - Event emitter for USB attach/detach and errors.
- React toggles between built-in and external camera views on all recording screens.

## Architecture
- React Native:
  - `CameraScreen` and `MemberRecordScreen` render a toggle.
  - Toggle switches between built-in view and `ExternalCameraView`.
  - Existing recording session/segmentation stays in JS.
- Android (Kotlin):
  - Camera enumeration via `CameraManager`.
  - Preview + recording via CameraX `Preview` + `VideoCapture`.
  - USB attach/detach handling with `UsbManager`.

## React Integration
- Add a toggle only when external camera is detected.
- On toggle:
  - Stop current recording.
  - Unbind camera use cases.
  - Mount the new camera view.
  - Resume recording if needed.
- Views:
  - Built-in uses existing `react-native-vision-camera`.
  - External uses `ExternalCameraView` native component.

## Native Module Design (Android)

### ExternalCameraView
- Wrap `PreviewView` in a React Native view manager.
- Make sure the Preview will be able to fill the screen edge to edge
- Use `match_parent` layout and `PreviewView.ScaleType.FILL_CENTER` by default.
- Update `targetRotation` from `PreviewView.display.rotation`.

### ExternalCameraModule API
- `getAvailableCameras()` -> list of camera IDs and facing (built-in/external).
- `setActiveCamera(cameraId)`
- `startRecording(outputPath, options)`
- `stopRecording()`
- Events:
  - `onUsbAttached`, `onUsbDetached`
  - `onCameraError`
  - `onRecordingStateChanged`

## Resolution and Quality Selection
- On USB attach:
  - Query supported sizes from Camera2 characteristics.
  - Use CameraX `QualitySelector` with highest supported quality.
  - Optionally cap max (ex: 1080p) for stability.
- Ensure preview and recording share a `ViewPort` so crop matches.

## Preview Fit and Rotation
- Use `PreviewView` to avoid manual sizing.
- Set `PreviewView.ScaleType` to `FILL_CENTER` (edge-to-edge) or `FIT_CENTER`
  (letterbox) per UX preference.
- Re-bind use cases on orientation changes and `onLayout` events.
- Make sure preview works on both landscape and portrait mode.

## Permissions
- Required: `CAMERA` and `android.hardware.usb.host`.
- Optional: remove microphone permission if audio is fully disabled.
- Request USB permission at attach time via `UsbManager`.

## Lifecycle
- On screen focus: bind camera use cases.
- On blur/background: stop recording and unbind.
- On USB detach: stop recording, show alert, fall back to built-in.

## Build Workflow (Local Gradle)
- Use Android Gradle builds for debug and release:
  - `./gradlew assembleDebug`
  - `./gradlew assembleRelease`
- No Expo Go usage.

## Risks and Fallbacks
- If external camera is not exposed via Camera2:
  - CameraX will not see it.
  - A UVC USB-host pipeline is required (separate preview + recording).
- Toggle requires careful resource teardown to avoid camera lock conflicts.

## Milestones
1. Camera2 probe: confirm external camera visibility and supported resolutions.
2. Implement `ExternalCameraView` + module API.
3. Add toggle to all recording screens.
4. Integrate lifecycle handling + orientation robustness.
5. QA on target devices (portrait/landscape, attach/detach, long sessions).
