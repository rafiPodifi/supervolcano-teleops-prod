# Feature 4 Implementation Checklist: Mobile Error Handling

_Last updated: 2026-04-23_

## Goal

Address mobile issue `#4` from `Supervolcano Production Readiness Report v2.md`:

> Error messages expose internal code details. In production, the app should show friendly messages while technical details are logged privately.

This checklist is based on the confirmed `Topic:Mobile-Error-Handling` decisions in `docs/supervolcano-prodfaq.md`.

## Product Rules to Enforce

- [x] Production users must never see raw exception text, stack traces, backend responses, or internal identifiers.
- [x] The global fatal error boundary uses one generic non-technical production message.
- [x] Recoverable errors use a controlled set of friendly categories rather than raw backend text.
- [x] Friendly categories must include at least:
- [x] `No internet`
- [x] `Upload failed`
- [x] `Permission needed`
- [x] `Recording unavailable`
- [x] `Something went wrong`
- [x] Upload failures trigger both:
- [x] an immediate friendly notification
- [x] a recoverable entry in a failed-uploaded-videos screen
- [x] The failed-uploaded-videos screen is only surfaced when failures exist.
- [x] The failed-uploaded-videos screen supports retry item, retry all, and delete.
- [x] Retry moves an item back into the normal upload queue without forcing the worker through the original recording flow again.
- [x] The fatal error screen should not offer in-app retry in v1.

## Implementation Work

### Global fatal error handling

- [x] Replace the current `App.tsx` error boundary UI so it never renders `error.message`, `error.toString()`, or stack details on screen.
- [x] Keep detailed diagnostics in private logs only.
- [x] Ensure the fatal error screen uses a single calm production message and restart guidance.
- [x] Remove any worker-visible technical detail block from the fatal fallback UI.

### Centralized error messaging

- [x] Introduce a centralized mobile error-mapping layer or helper for user-facing copy.
- [x] Map raw runtime/API/upload/auth errors into the approved friendly categories.
- [x] Ensure the mapping is reusable across alerts, toasts, queue UI, and screen-level empty/error states.
- [x] Prevent direct `error.message` rendering in production-facing alerts and views.

### Flow-by-flow sanitization pass

- [x] Audit login/auth flows for direct user-facing technical messages.
- [x] Audit recording flows for direct user-facing technical messages.
- [x] Audit upload queue and retry flows for direct user-facing technical messages.
- [x] Audit task/location loading flows for direct user-facing technical messages.
- [x] Replace raw copy with friendly scenario-based messaging in each affected screen/service.

### Failed-uploaded-videos screen

- [x] Add a dedicated failed-uploaded-videos screen to the mobile app.
- [x] Show worker-safe item labels and timestamps only.
- [x] Add retry per item.
- [x] Add retry all failed items.
- [x] Add delete for discarded failed items.
- [x] Keep technical diagnostics out of the worker-facing UI.
- [x] Surface the entry point only when failures exist.
- [x] Link to the screen from upload-failure notifications and queue-related entry points.

### Queue and notification behavior

- [x] Emit a friendly immediate notification when an upload fails.
- [x] Keep failed items in a recoverable failed state until retried or deleted.
- [x] Ensure retry returns items to the normal upload queue immediately.
- [x] Confirm retry does not require metadata re-entry unless the queued item is invalid.

### Logging and privacy

- [x] Preserve internal diagnostics in logs for debugging and support.
- [x] Review logging paths to ensure user-visible copy does not accidentally interpolate raw backend text.
- [x] Keep any support-oriented detail out of normal production worker screens.

## Validation

- [ ] Trigger a fatal error path and confirm the fallback screen shows only sanitized production copy.
- [ ] Trigger a login failure and confirm the app shows only a friendly mapped message.
- [ ] Trigger a recording-related failure and confirm the app shows only a friendly mapped message.
- [ ] Trigger an upload failure and confirm:
- [ ] a friendly notification appears immediately
- [ ] the failed item appears in the failed-uploaded-videos screen
- [ ] retry moves the item back into the normal upload queue
- [ ] delete removes the failed item cleanly
- [ ] Confirm the failed-uploaded-videos entry point is visible only when failures exist.
- [ ] Confirm no normal production role can see raw technical error text anywhere in the mobile app.
