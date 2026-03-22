---
name: android-kotlin-engineer
description: Kotlin-first Android engineering for this Expo/React Native app, including native module and view-manager work, CameraX and USB or external camera support, video recording and upload pipelines, preview sizing and aspect-ratio fixes, package selection, and Android-focused end-to-end testing. Use when Codex needs to add or debug Android-specific behavior in `mobile-app/android`, bridge Kotlin code to `mobile-app/src`, choose suitable Android or React Native packages, harden recording or upload flows, fix external camera preview layout issues, or add test coverage for flows such as permissions, camera switching, recording, and uploads.
---

# Android Kotlin Engineer

## Overview

Work from the Android layer upward. Treat Kotlin as the source of truth for hardware access, lifecycle, camera binding, background execution, and reliability-critical work; keep React Native and Expo focused on UI, orchestration, and bridge contracts.

## Workflow

1. Classify the request before editing.
- Start in Kotlin for USB, CameraX, permissions, preview surfaces, recording, orientation, and long-running uploads.
- Start in TypeScript only for UI state, controls, progress display, and bridge wiring.
- Inspect both layers for layout or aspect-ratio bugs because the failure can be caused by either `PreviewView` policy or React Native container sizing.

2. Rebuild local context from the repo.
- Read `references/project-map.md` first.
- Read `references/package-selection.md` when package choice or architecture is part of the task.
- Read `references/testing-playbook.md` before adding tests or claiming a fix is verified.

3. Choose the narrowest implementation that can survive production use.
- Reuse the existing `ExternalCameraModule`, `ExternalCameraPackage`, `ExternalCameraView`, and `ExternalCameraController` before adding new packages.
- Keep the JS bridge stable when possible; expand options and events rather than replacing contracts.
- Escalate to native background infrastructure when upload or recording behavior must survive app state changes, connectivity loss, or long runtimes.

## Camera Rules

- For external USB camera requests, first confirm whether the device becomes visible through `CameraManager` as a Camera2 external camera after USB permission. If it does, keep the CameraX-based path.
- If the USB device can be detected by `UsbManager` but never appears as a usable camera, do not keep forcing CameraX. Prefer a vendor SDK; if none exists, isolate any UVC library behind the existing native module so the TypeScript API stays small.
- For "fit into screen while keeping best resolution and consistent aspect ratio", default to a fit policy instead of a crop policy. The current native code uses `PreviewView.ScaleType.FILL_CENTER`; that is a crop-first choice and should be changed only when cropping is explicitly desired.
- Pair preview and recording through a shared viewport or aspect ratio. Keep preview presentation independent from capture quality so high-resolution recording does not force stretched or cropped UI.
- Avoid blindly using `Quality.HIGHEST` for every device. Prefer the highest quality that matches the requested aspect ratio and performs reliably on the target hardware.

## Upload Rules

- Avoid production paths that read large videos fully into JS memory with `fetch(videoUri)` and `blob()` unless file sizes are known to be small and the upload is foreground-only.
- For secure and robust uploads, prefer a durable queue, backoff, retry, and connectivity awareness. When uploads must continue or recover across app restarts, move job ownership to native Android with `WorkManager`.
- Keep UI progress in JS if helpful, but do not make JS the only owner of a long-running upload.
- Prefer idempotent server-side semantics when available: stable upload IDs, checksum validation, resumable sessions, and explicit completion states.

## Testing Rules

- Use Maestro by default for Android end-to-end flows in this app. It is the best default for permission dialogs, black-box validation, native surfaces, and React Native screens.
- Use Detox only when you need tighter app-driven synchronization or a test harness already exists.
- Use Kotlin unit or instrumented tests for behavior Maestro cannot prove well: camera selection fallback, permission receivers, upload queue persistence, and quality or aspect-ratio decision logic.
- Treat physical Android hardware as mandatory for external camera validation. Emulators are not sufficient for USB OTG and real recording pipelines.

## Output Expectations

- When choosing a package, state why the current stack is insufficient.
- When editing native camera features, report the affected Kotlin files, TypeScript bridge files, UI files, Gradle or manifest changes, and how the feature was validated.
- When you cannot fully validate because hardware is missing, say exactly which device or setup is required.

## References

- `references/project-map.md`: current stack, file map, and existing Android camera or upload integration points.
- `references/package-selection.md`: package and architecture heuristics for camera, USB, uploads, persistence, and testing.
- `references/testing-playbook.md`: Android-specific validation strategy for UI, native behavior, and external hardware scenarios.
