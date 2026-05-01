# Feature 13 Implementation Checklist: Offline Recording Mode

_Last updated: 2026-04-23_

## Product Decisions to Enforce

- [x] Generic recording is available from the logged-in app home page.
- [x] Generic recording is available both online and offline.
- [x] Entering generic recording first shows two paths: `Assign pending uploads` and `Do a recording`.
- [x] Recording can start without location or task selection.
- [x] Final upload requires both location and task.
- [x] One recording maps to exactly one final location-task assignment.
- [x] Assignment uses the current live authorized location/task list, not an old local snapshot.
- [x] If no valid task exists for a location, upload stays blocked and the worker can retry later, choose another location, or delete the recording.
- [x] Pending generic recordings do not block starting a new generic recording.
- [x] When connectivity returns, the app shows a non-blocking prompt or badge instead of forcing the worker into assignment.
- [x] After metadata is complete, a final `Upload` button explicitly starts upload.
- [x] Upload initiation must be idempotent.

## Android App Work

### Queue and persistence

- [ ] Extend the persistent upload queue to support recordings with no initial assignment.
- [ ] Add a `needs_assignment` state distinct from upload-ready items.
- [ ] Keep generic recordings in durable app-controlled storage.
- [ ] Preserve assignment once upload has started.
- [ ] Allow pending generic recordings to be deleted with confirmation.

### Navigation and entry points

- [ ] Add a first-class generic recording entry to the logged-in cleaner home screen.
- [ ] Add a generic recording hub screen with:
- [ ] `Assign pending uploads`
- [ ] `Do a recording`
- [ ] Show a non-blocking badge when generic recordings need assignment.

### Recording flow

- [ ] Allow `CameraScreen` to start in generic mode without location/job params.
- [ ] Queue generic recordings locally after capture instead of uploading immediately.
- [ ] After a generic recording ends, return to the generic hub instead of forcing assignment.

### Assignment flow

- [ ] Add a screen for pending generic recordings awaiting assignment.
- [ ] Load the worker's current authorized locations at assignment time.
- [ ] Load tasks only after a location is chosen.
- [ ] Block upload when the chosen location has no valid tasks.
- [ ] Require both location and task before enabling the final `Upload` button.
- [ ] Start upload only when the worker taps `Upload`.

### Upload and recovery

- [ ] Resume interrupted uploads with the existing reconnect-capable queue.
- [ ] Prevent duplicate uploads from repeat taps or app restarts.
- [ ] Keep existing assigned-task recording behavior intact.

## Validation

- [ ] Record a generic session while offline and confirm it lands in `needs assignment`.
- [ ] Reopen the app and confirm the pending generic recording persists.
- [ ] Assign a location and task and verify the explicit `Upload` action is required.
- [ ] Confirm generic recordings remain available while the worker is online.
- [ ] Confirm a location with zero tasks blocks upload and still allows delete.
- [ ] Confirm repeated taps on `Upload` do not create duplicate queue items.
