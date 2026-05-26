Features Requests

- Automatic Upload: Automatically upload videos after recording. DONE — UploadQueueService auto-enqueues each finalized segment, retries with exponential backoff (5 attempts: 1s/5s/15s/60s/5m), resumes on network reconnect via NetInfo, and continues in background via expo-background-fetch.
- Geo-tagging: Use GPS to geo tag the videos. DONE — coords captured on session start (best-effort, 500ms cap with mount-time prefetch), stored on QueuedVideo, sent in saveMediaMetadata POST body, persisted to Firestore media doc as latitude/longitude, surfaced as GPS column in admin Media Library.
- Camera View: Hide the native camera view or have it open to external and display a message to connect the camera if it is not detected. DONE
- Video Segmentation: Implement recording of fixed-length segments, ideally 2-minute files, on the phone instead of a single continuous long video file. DONE — both recording screens (CameraScreen, MemberRecordScreen) now do continuous auto-segmentation. Duration is remotely configurable via Firestore `config/recording-settings` → `segmentDurationSeconds` (clamped 30s–3600s, default 300s). To switch to 2-minute segments, set the field to 120.
- Audio Recording: Disable audio recording immediately. DONE
- Cache the locations so they are available even if there is not active internet at the location. TODO — `fetchAssignedLocationsForCurrentUser()` and `fetchJobsForLocation()` currently have no AsyncStorage backing.
- Would be great to be able to open and see pending upload queue. DONE — both CameraScreen and MemberRecordScreen now show a tappable badge with queue total when not recording. Tap routes to FailedUploads or GenericPendingUploads depending on state. UploadQueueScreen also available for full debug view.
- Time stamp in the Creation column in the Media Library instead of a date. TODO — current display uses `uploadedAt` (server-write time). Need to thread `startedAt`/`endedAt` (already on QueuedVideo) through saveMediaMetadata → Firestore → web display.

Bug Reports

- The app got stuck on the capture screen after ending a recording. FIXED — root cause was per-recording `setVideoCaptureConfig` call in UvcBackend.kt disrupting herohan's finalize flow. Audio-disable moved to `init()`. JS native awaits wrapped in try/catch so UI always unfreezes.
- App shows a pending upload even after all videos have been uploaded. Eventually resolved itself. TODO — likely race between listener notification (sync) and queue removal (async persistState). Eventually consistent today; needs investigation for a clean fix.
- I have noticed twice that an upload failed. I believe it was because the phone went to sleep(?). TODO — current retry covers network drops but Android aggressively throttles background fetch. Real fix is a foreground service or WakeLock during active upload.
