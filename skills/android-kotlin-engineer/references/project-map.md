# Project Map

## Stack Snapshot

- `mobile-app/package.json`
  - Expo `~54.0.25`
  - React Native `0.81.5`
  - React `19.1.0`
  - `react-native-vision-camera` `^4.0.0`
  - `expo-camera` `^17.0.9`
  - `@react-native-community/netinfo` is already present for connectivity awareness
- `mobile-app/android/app/build.gradle`
  - Kotlin Android plugin is enabled
  - CameraX `1.3.4` is already added

## Native Android Entry Points

- `mobile-app/android/app/src/main/java/com/supervolcano/camera/MainApplication.kt`
  - Registers `ExternalCameraPackage()` manually.
- `mobile-app/android/app/src/main/java/com/supervolcano/camera/external/ExternalCameraPackage.kt`
  - Connects the native module and view manager into React Native.
- `mobile-app/android/app/src/main/java/com/supervolcano/camera/external/ExternalCameraModule.kt`
  - Owns USB attach or detach events, USB permission flow, camera availability events, and JS-exposed methods such as `getAvailableCameras`, `setActiveCamera`, `startRecording`, and `stopRecording`.
- `mobile-app/android/app/src/main/java/com/supervolcano/camera/external/ExternalCameraController.kt`
  - Owns CameraX preview and recording binding.
  - Currently sets `PreviewView.ScaleType.FILL_CENTER`.
  - Currently uses `QualitySelector.from(Quality.HIGHEST)` as the default.
- `mobile-app/android/app/src/main/java/com/supervolcano/camera/external/ExternalCameraViewManager.kt`
  - Creates the `PreviewView` surfaced to React Native.
  - Also defaults to `PreviewView.ScaleType.FILL_CENTER`.

## React Native Integration Points

- `mobile-app/src/native/external-camera.ts`
  - TypeScript bridge over `NativeModules.ExternalCameraModule`.
  - Defines event shapes for camera availability, recording state, and USB permission events.
- `mobile-app/src/screens/member/MemberRecordScreen.tsx`
  - Main screen coordinating built-in camera versus external camera mode.
  - Uses `react-native-vision-camera` for built-in camera flows.
  - Uses `ExternalCameraView` and `ExternalCamera` bridge for external camera flows.
- `mobile-app/src/components/external-camera/`
  - Contains UI around external camera preview and controls.

## Upload-Related Code

- `mobile-app/src/services/upload.ts`
  - Current direct upload path to Firebase Storage.
  - Reads the file through `fetch(videoUri)` and `blob()`, which is a likely bottleneck for large or long-running uploads.
- `mobile-app/src/services/video-upload.service.ts`
  - Additional upload-related logic worth checking before adding new paths.
- `mobile-app/src/services/segmented-recording.service.ts`
  - Existing queueing and segmented recording behavior.
  - Good starting point if upload reliability work must preserve partial progress or retries.

## Android-Specific Signals Already Present

- `mobile-app/app.json`
  - Android camera, audio, Bluetooth, and location permissions are already declared.
  - `react-native-vision-camera`, `expo-camera`, `react-native-ble-plx`, and `expo-location` plugins are configured.
- `mobile-app/android/app/src/main/AndroidManifest.xml`
  - Read before adding foreground services, USB host features, or storage-related declarations.

## Default Reading Order

1. `mobile-app/package.json`
2. `mobile-app/android/app/build.gradle`
3. `mobile-app/android/app/src/main/java/com/supervolcano/camera/external/ExternalCameraController.kt`
4. `mobile-app/android/app/src/main/java/com/supervolcano/camera/external/ExternalCameraModule.kt`
5. `mobile-app/src/native/external-camera.ts`
6. `mobile-app/src/screens/member/MemberRecordScreen.tsx`
7. Upload service files if the request touches persistence, retry, backgrounding, or transport
