# Package Selection

## Default Rule

Do not add a package until you can name the exact gap in the current stack.

## Camera And External Device Decisions

### Built-in phone camera

- Prefer the existing `react-native-vision-camera` path for built-in device camera work that can remain JS-driven.
- Keep Expo camera usage minimal unless a screen is already built around it.

### External USB camera that appears through Camera2

- Prefer the existing CameraX stack already present in `mobile-app/android/app/build.gradle`.
- Keep the current native bridge shape and extend `ExternalCameraController.kt` or `ExternalCameraModule.kt` first.
- Favor CameraX plus Camera2 interop over adding another React Native camera package.

### External USB camera that does not appear as a usable camera

- First choice: vendor-maintained Android SDK, wrapped behind the existing native module.
- Second choice: a focused UVC library, also wrapped behind the native module.
- Do not push raw USB video handling into TypeScript.
- Do not assume `react-native-vision-camera` or `expo-camera` can solve arbitrary UVC or vendor-specific hardware support.

## Preview And Aspect Ratio Decisions

- Use `PreviewView.ScaleType.FIT_CENTER` or another fit-based strategy when the requirement is "show the whole frame".
- Use `FILL_CENTER` only when crop-to-fill is explicitly desired.
- Keep capture quality selection separate from preview scaling.
- When high resolution and stable framing are both required, prefer selecting a supported resolution or quality that matches the screen or product aspect ratio instead of always taking the absolute maximum.

## Upload And Persistence Decisions

### Keep the existing JS upload path only when all of these are true

- Uploads are short enough to stay in foreground.
- Full-file memory usage is acceptable.
- Retry and background recovery are not core requirements.

### Move upload ownership to native Android when any of these are true

- Upload must survive app backgrounding or process death.
- Files are large enough that JS memory pressure is risky.
- Connectivity changes and retries are part of the feature definition.
- You need stronger guarantees than "best effort while screen is open".

### Native Android packages to prefer for robust uploads

- `androidx.work:work-runtime-ktx`
  - Durable scheduling, retry, backoff, constraints, and recovery after restart.
- `org.jetbrains.kotlinx:kotlinx-coroutines-android`
  - Structured concurrency for Kotlin workers and native modules.
- `com.squareup.okhttp3:okhttp`
  - Reliable streaming and transport control.
- `androidx.room:room-ktx`
  - Durable queue state when upload jobs need persistence and reconciliation.
- `androidx.datastore:datastore-preferences`
  - Lightweight settings or flags, not a replacement for a job queue.

### Backend choice heuristics

- If Firebase Storage remains the storage backend, use its resumable semantics only if they fit the reliability requirements; otherwise consider a native upload orchestrator that still targets Firebase.
- If the backend exposes TUS, multipart resumable upload, or signed URLs, design around that transport instead of forcing JS blob uploads.
- Prefer server-side idempotency and checksum verification whenever you can influence the backend contract.

## Testing Package Decisions

- Default E2E: Maestro.
- Optional E2E: Detox when tighter app-level synchronization is worth the setup cost.
- Native logic tests: JUnit plus instrumented Android tests for Kotlin-only behavior.
- Avoid snapshot-only testing as the primary proof for camera surfaces; use it as support, not the main signal.

## When Adding A New Package

State all of the following in the implementation notes:

1. What the current stack cannot do.
2. Why the new package is the narrowest acceptable addition.
3. Which existing files will wrap or isolate the package.
4. How the package will be validated on real Android hardware.
