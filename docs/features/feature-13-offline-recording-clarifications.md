# Feature 13 Clarifications: Offline Recording Mode

_Captured on 2026-04-23 from PB inline review of `Supervolcano Production Readiness Report v2.md` item #13._

## Scope

Feature `#13` is the mobile-app capability to let a logged-in worker create a generic recording session without a pre-assigned task, then complete assignment and upload later.

## Confirmed v1 Decisions

1. The generic recording entry point must be available from the logged-in app home page.
2. The feature must be available both offline and online.
3. The generic flow opens to a chooser screen with two actions: `Assign pending uploads` and `Do a recording`.
4. Workers can start a generic recording without selecting location or task first.
5. Generic recordings are stored in a durable app-controlled local queue, not a temporary folder.
6. After recording completes, the app should return the worker to the generic chooser or home context instead of forcing assignment immediately.
7. Pending recordings remain visible and do not block starting a new recording unless storage is low or session recovery is required.
8. Assignment must use the current live authorized location and task list once the device is online.
9. Final upload always requires both a location and a task.
10. One recording maps to exactly one final location-task assignment in v1.
11. If no valid task exists for a chosen location, the worker cannot upload against that location; they can choose another location, retry later, or delete the recording.
12. Deleting a pending recording requires confirmation, but no reason is required in v1.
13. After required metadata is completed in the assignment modal, the app should show a final `Upload` button to explicitly start upload.
14. When connectivity returns, the app should show a non-blocking prompt or badge rather than interrupting the worker with a forced modal.
15. Once upload begins, the assigned location and task are locked for that queue item.
16. Upload recovery should reuse the existing reconnect-capable queue and preserve metadata across app closes, backgrounding, and network loss.
17. Upload initiation must be idempotent so repeated taps or app restarts do not create duplicate uploads.
18. Generic recording should be available to the same worker roles that can already record assigned tasks.

## Recommended UX Shape

1. Home page shows a first-class generic recording entry.
2. Entering that flow opens a chooser:
   - `Assign pending uploads`
   - `Do a recording`
3. The `Assign pending uploads` path shows the pending queue and pending count.
4. Each pending item opens an assignment modal requiring:
   - location
   - task
5. After both are selected, the UI enables a final `Upload` button.

## State Model

Suggested queue lifecycle based on confirmed decisions:

1. `Recorded locally`
2. `Pending assignment`
3. `Ready to upload`
4. `Uploading`
5. `Upload failed`
6. `Uploaded`

Deletion is a separate destructive action, not a normal persistent status.

## Implementation Notes

1. The queue should persist across app restarts and offline periods.
2. The upload job should resume or retry through the existing reconnect logic.
3. Metadata selection must be validated against current server-authorized locations and tasks, not an old local snapshot.
4. Duplicate upload prevention should be enforced per pending recording at both UI and queue layers.
5. Lightweight deletion audit metadata is acceptable if easy to retain locally, but the deleted media file itself should be removed.

## Open Non-Blocking Questions

1. Whether the pending queue needs thumbnails, duration, file size, or recorded-at timestamps in the UI.
2. Whether task search/filtering is needed in the assignment modal for large task lists.
3. Whether uploads should auto-start immediately after connectivity returns if metadata was already completed before going offline.
4. Whether deletion audit metadata should ever sync server-side for operations visibility.
