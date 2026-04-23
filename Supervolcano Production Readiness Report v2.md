

**SUPERVOLCANO TELEOPS**

Production Readiness Report v2

*Updated April 14, 2026  —  Revised after team alignment meeting*  
*Made by Podifi*

Confidential — Internal Use Only

# 

# **What Is This Report?**

Supervolcano Teleops is a field operations platform made up of two parts: a **mobile app** for workers in the field, and a **web dashboard** for managers and administrators.

The **mobile app** runs on Android phones. Workers connect an external USB camera, start a session, record video, and the app automatically uploads the footage to the cloud and tracks their milestones.

The **web dashboard** is used by managers to oversee locations, teams, tasks, and video footage. It has a built-in rewards system to motivate field workers.

This report is a plain-language summary of what is working, what needs to be fixed before real users can depend on this platform every day, and what the team agreed to in the April 13th meeting. Every issue is given a priority level:

| Level | Name | What It Means |
| :---- | :---- | :---- |
| **P0** | **Critical** | Must be fixed before any real users access the platform. These are blockers. |
| **P1** | **High** | Should be fixed before launch. These are serious risks to reliability or security. |
| **P2** | **Medium** | Address in the first sprint after launch. Real-world gaps that users will notice. |
| **P3** | **Low** | Polish and best-practice improvements. Work through in ongoing sprints. |

# **Executive Summary**

The core technology works. Workers can log in, record video, and upload footage to the cloud. Managers can log in to the dashboard and manage their teams. The foundation is solid.

Following the April 13th team meeting, this report has been updated to reflect new decisions and priorities. The team aligned on the following additions to the original findings:

* Camera disconnect should cleanly end the current session and cap the video, allowing the worker to start fresh if it was accidental.

* An offline recording mode is needed so workers without the internet can still record and tag the location later.

* An automatic recording shut-off after 15 minutes of inactivity will prevent accidental footage capture.

* The GoPro provider code should be removed from the codebase as it is no longer relevant.

* A staging environment and improved CI/CD deployment pipeline will be set up alongside production.

* Sameer will coordinate pickup of 1–2 camera units from Tony for testing.

There are now **47 total items** identified across both components. Seven are launch blockers. Thirteen are high-priority items. The rest form a healthy pre/post-launch backlog.

# **Part 1 — Mobile App (Android)**

The mobile app's core promise is straightforward: a field worker connects a USB camera to their Android phone, records their session, and the platform handles upload, progress tracking, and milestones automatically.

Right now, that promise is broken at several critical points. Four of these are blockers that must be fixed before anything else.

  **P0 — Critical**  

These four issues prevent the app from working correctly. No other development should proceed until these are resolved.

| Done | \# | Issue & Plain-English Explanation | Where in the Code |
| :---- | :---- | :---- | :---- |
| [x] | **1** | **Recording can start before the camera is ready** If the external camera is still initialising, tapping Record silently does nothing — no error, no feedback. The worker has no idea their session was never recorded. | *MemberRecordScreen.tsx :265–268* |
| [x] | **2** | **Camera disconnect mid-recording is not handled** If the camera unplugs while recording, the app gets confused: the session stays active but the camera is gone. Per the April 13 meeting: disconnect should cleanly end the session and cap the video. | *MemberRecordScreen.tsx :100* |
| [x] | **3** | **Camera connection timeout with no recovery** If the external camera fails to connect within 15 seconds, the app stops trying and gets stuck with no message and no way to retry. This must be fixed so the app can recover. | *App.tsx :13–14, 65–66* |
| [ ] | **4** | **Error messages expose internal code details** When something goes wrong, the app shows the full technical error on screen. In production, a friendly message should be shown; technical details should be logged privately. | *App.tsx :47–53* |
| [x] | **5** | **USB camera capabilities are not detected before recording** The app records at a fixed quality profile without checking what resolutions, framerates, or formats the connected camera actually supports. On cameras that do not support the configured profile, recording may fail silently, produce a corrupt file, or record at an unexpected resolution. The app should query the connected camera's supported capabilities at connection time and automatically select the best matching profile, falling back gracefully if the configured quality is unavailable. | external-camera.ts, useRecordingConfig.ts



  **P1 — High Priority**  

These seven issues are serious risks that should be fixed before or immediately at launch.

| Done | \# | Issue & Plain-English Explanation | Where in the Code |
| :---- | :---- | :---- | :---- |
| [ ] | **5** | **No crash or error reporting** When the app crashes in the field, the engineering team has no way of knowing. Integrating a crash reporting tool (such as Sentry or Firebase Crashlytics) is essential before workers depend on the app daily. | *App.tsx :32–35* |
| [x] | **6** | **Camera status check runs in an aggressive loop** The app checks camera status every 50 milliseconds in a tight loop, wasting battery and CPU. It should listen for camera status events instead. | *useExternalCameraDiagnostics.ts :253–271* |
| [ ] | **7** | **Mode-switch during recording can hang indefinitely** When switching camera modes while recording, the app can wait forever for the camera with no feedback to the worker and no way to recover. | *MemberRecordScreen.tsx :386–401* |
| [ ] | **8** | **Automatic inactivity shut-off (NEW — from April 13 meeting)** To prevent workers accidentally leaving a recording running, the app should automatically stop recording after 15 minutes of no activity. The default duration should be configurable remotely. | *MemberRecordScreen.tsx (new)* |
| [ ] | **9** | **Video file has no file extension** Recorded video files are saved without the .mp4 extension, which can cause problems when uploading or playing back the file. | *MemberRecordScreen.tsx :239* |
| [ ] | **10** | **Stopping a recording that never started causes confusion** If the app tries to stop a recording that was never started, it incorrectly marks itself as not recording, hiding the true session state. | *MemberRecordScreen.tsx :281–300* |
| [ ] | **11** | **Remove GoPro provider code (from April 13 meeting)** There is leftover GoPro integration code no longer in use. The team agreed it should be removed to keep the codebase clean. | *App.tsx* |
| [x] | **12** | **Uploads restart after reconnection (from April 13 meeting)** If a worker loses internet mid-upload and reconnects, the upload should automatically restart. The team confirmed this will definitely happen in the field. | *upload-queue.service.ts* |
| [ ] | **13** | **Offline recording mode (NEW — from April 13 meeting)** Workers without internet cannot see their assigned tasks. A 'generic record session' feature will allow recording without a task, with location tagging at upload time. This should be available even when online. Aulia will prepare a mockup before development. | *New feature* |
| [x] | **14** | **Recording quality hardcoded** Camera quality and audio settings are fixed in the code. These should be adjustable without releasing a new app version. | *MemberRecordScreen.tsx :256–258* |
| [ ] | **15** | **Reward thresholds hardcoded** The hours required to earn rewards are fixed in the code and should be adjustable remotely. | *MemberRecordScreen.tsx :48* |

  **P2 — Medium Priority**  

These nine issues will not block launch but will surface quickly in real-world use.

| Done | \# | Issue & Plain-English Explanation | Where in the Code |
| :---- | :---- | :---- | :---- |
| [ ] | **16** | **Videos stop uploading when the app is backgrounded** If a worker presses the home button while a video uploads, the upload stops. It should continue in the background. | *upload-queue.service.ts* |
| [ ] | **17** | **Failed uploads are silently discarded** If a video fails to upload after 5 attempts, it is quietly dropped with no notification. There should be a visible list of failed uploads with a manual retry option. | *upload-queue.service.ts :16–19* |
| [ ] | **18** | **Recorded videos saved in a temporary folder** The OS can delete the temporary folder at any time, potentially erasing videos before they upload. Videos should be saved to a protected location. | *MemberRecordScreen.tsx :224* |
| [ ] | **19** | **No storage check before recording** If the phone is nearly full, recording will fail partway through without a clear explanation. The app should check available storage first. | *MemberRecordScreen.tsx :243* |
| [ ] | **20** | **Some errors are silently ignored** When the USB camera attaches, errors from the refresh function are silently swallowed, making problems hard to diagnose. | *useExternalCameraDiagnostics.ts :281–284* |
| [ ] | **21** | **Native camera calls can hang indefinitely** Calls to the native camera module can freeze without responding. A timeout should be added so the app can recover. | *external-camera.ts :125–149* |
| [ ] | **22** | **User profile stored without encryption** Worker profile data is stored on the device without encryption. On a compromised device, this could be read by other apps. | *auth.service.ts, AuthContext.tsx :35–39* |

  **P3 — Low Priority**  

These are polish and best-practice improvements to work through over time.

| Done | \# | Issue & Plain-English Explanation | Where in the Code |
| :---- | :---- | :---- | :---- |
| [ ] | **23** | **Developer logs printing on every screen update** The app logs a message every time the recording screen refreshes. All developer logs should be removed or hidden in production builds. | *App.tsx :60, MemberRecordScreen.tsx :91* |
| [ ] | **24** | **No app versioning strategy** The app is at version 1.0.1 with no automated version-bumping process. A clear versioning and build pipeline should be established. | *app.json, build.gradle* |
| [ ] | **25** | **GoPro provider tree position to verify on re-enable** If GoPro support is added in the future, its component needs to be placed correctly in the app's tree. | *App.tsx* |

# **Part 2 — Web Dashboard**

The web dashboard is used by managers to view footage, manage teams, and administer the platform.

The dashboard is functionally stable. However, the security audit found **three critical vulnerabilities** that would make it an immediate liability in production. These are not theoretical — they can be exploited today.

  **P0 — Critical**  

These three security issues are launch blockers. The dashboard must not go live until all three are fixed.

| Done | \# | Issue & Plain-English Explanation | Where in the Code |
| :---- | :---- | :---- | :---- |
| [ ] | **1** | **Anyone on the internet can upload files to the platform** A misconfiguration means anyone — without logging in — can upload files to the platform's storage. This needs to be locked down immediately. | *storage.rules :42–45* |
| [ ] | **2** | **The dashboard accepts requests from any website** A malicious site could trick a logged-in manager into performing actions they didn't intend (a CSRF attack). Only the official platform domain should be accepted. | *next.config.mjs :14* |
| [ ] | **3** | **A single permanent admin password grants full access forever** There is one static secret key for full admin API access. If leaked, it grants permanent access with no way to revoke it without reconfiguring the entire system. | *src/lib/apiAuth.ts* |

  **P1 — High Priority**  

These six issues are serious security and reliability risks to address alongside or immediately after the P0 items.

| Done | \# | Issue & Plain-English Explanation | Where in the Code |
| :---- | :---- | :---- | :---- |
| [ ] | **4** | **No standard web security protections on responses** The dashboard is missing several standard security headers that protect users from common attacks like clickjacking. These are simple to add. | *next.config.mjs* |
| [ ] | **5** | **Personal data appearing in server logs** Over 2,000 places in the dashboard log personal information including user IDs and email addresses. The team agreed emails should be masked or hashed in logs. No PII should appear in plain text. | *src/app/api/\*\** |
| [ ] | **6** | **Internal error details exposed to users** Database error messages are sent to the user's browser, potentially exposing internal system structure to attackers. Only a generic error should be shown. | *src/app/api/\*\** |
| [ ] | **7** | **Any user can edit instruction images for any location** Any logged-in user can overwrite instruction images for any location, regardless of whether they manage it. This should be restricted to authorised users of that specific location. | *storage.rules :29–31* |
| [ ] | **8** | **No rate limiting anywhere on the platform** Without rate limiting, the platform is open to brute-force attacks and abuse that could result in large unexpected cloud bills. | *src/app/api/\*\** |
| [ ] | **9** | **Robot API has fully open access** The robot communication endpoint allows requests from anywhere. Server-side authentication must be confirmed for all robot routes. | *src/app/api/robot/v1/* |

  **P2 — Medium Priority**  

These seven issues will not block launch but represent reliability and data accuracy gaps that will surface quickly.

| Done | \# | Issue & Plain-English Explanation | Where in the Code |
| :---- | :---- | :---- | :---- |
| [ ] | **10** | **No limit on request sizes** Extremely large requests could slow down or crash the server. A maximum request size should be enforced. | *src/app/api/\*\** |
| [ ] | **11** | **Database sync failures are invisible** When the Firebase–PostgreSQL sync fails, robots query stale data with no alert. Monitoring and alerts should be added. | *src/lib/services/sync/firestoreToSql.ts* |
| [ ] | **12** | **Large lists loaded all at once** As the platform grows, loading all locations, users, or tasks at once will become slow and expensive. Paginated loading should be implemented. | *src/lib/repositories/\*\** |
| [ ] | **13** | **Scheduled tasks may be triggerable by anyone** Automated scheduled jobs may not be protected, meaning anyone could trigger them by accessing the right URL. | *src/app/api/cron/* |
| [ ] | **14** | **Videos can be viewed by any authenticated user** Any logged-in user can view any video, regardless of organisation or location. Access should be scoped to authorised users for that location. | *storage.rules :67* |
| [ ] | **15** | **Security settings applied inconsistently** CORS settings are configured individually per endpoint, risking some endpoints being misconfigured. These should be centralised. | *src/app/api/\*\** |
| [ ] | **16** | **Outdated framework version** The dashboard runs Next.js 14.2.11. Upgrading to version 15 brings security patches and performance improvements. | *package.json :35* |

  **P3 — Low Priority**  

These are best-practice improvements for the longer-term health of the platform.

| Done | \# | Issue & Plain-English Explanation | Where in the Code |
| :---- | :---- | :---- | :---- |
| [ ] | **17** | **No system monitoring or performance dashboards** There is no tooling to observe platform performance, trace slow requests, or identify errors in real time. | *(whole dashboard)* |
| [ ] | **18** | **No automated tests** There are no automated tests in the codebase. At minimum, login flows, permissions, and critical API routes should be covered. | *src/app/api/\*\** |
| [ ] | **19** | **Missing configuration only caught at runtime** If a required environment variable is missing, the platform discovers it only when a user triggers that code path. It should fail loudly at startup. | *src/lib/firebaseAdmin.ts* |
| [ ] | **20** | **Unusual dependency version** One library (uuid) appears to be at an unusual version. This should be verified. | *package.json* |
| [ ] | **21** | **No API versioning strategy** The platform has inconsistently named API endpoints with no documented lifecycle strategy. | *src/app/api/* |
| [ ] | **22** | **Firebase SDK version mismatch** The server-side and client-side Firebase libraries are from different major versions and should be aligned. | *package.json* |

# **Summary of All Issues**

The table below consolidates all findings across both components.

| Component | P0 Critical | P1 High | P2 Medium | P3 Low |
| :---- | :---- | :---- | :---- | :---- |
| **Mobile App (Android)** | **4** | **7** | **9** | **5** |
| **Web Dashboard** | **3** | **6** | **7** | **6** |
| **TOTAL** | **7** | **13** | **16** | **11** |

*Total: 47 items across both components (updated from 46 to reflect new items agreed in the April 13 meeting).*

# **Next Steps (Agreed April 13, 2026\)**

The following actions were agreed at the April 13 team meeting.

| Done | Owner | Action |
| :---- | :---- | :---- |
| [ ] | **Sameer Merchant** | Coordinate with Tony Lomelino to pick up 1–2 camera units for testing. |
| [ ] | **Sameer Merchant** | Reach out to Morgan Brewster and Tony Lomelino separately regarding paperwork to restart project work. |
| [ ] | **Aulia Rafi** | Update the CI/CD pipeline: create separate staging and production environments; configure GitHub branches to deploy to the correct environment. |
| [ ] | **Aulia Rafi** | Prepare a mockup and logical flow diagram for the offline (generic) recording feature. |
| [ ] | **Arsh Bhanji** | Implement generic recording: allow video capture without an assigned location or task, prompting the user to select both at upload time. |
| [ ] | **Tony Lomelino** | Talk to Chris regarding GitHub repo access and deployment space connections. |
| [ ] | **Engineer** | Implement 15-minute inactivity recording shut-off with adjustable default duration. |
| [ ] | **The Group** | Address all P0/P1 dashboard security issues: input sanitisation, origin restriction, PII hashing, error filtering, rate limiting, and request size limits. |

# **Pre-Launch Verification Checklist**

Every item below must pass before either component is considered production-ready.

| Done | Test Scenario | Expected Result |
| :---- | :---- | :---- |
| [ ] | Mobile — End-to-end recording: run a full record → upload flow on a real Android device with a USB camera. | Video appears in Firestore; worker's hours update correctly; progress shows real data. |
| [ ] | Mobile — Camera robustness: unplug camera mid-recording; switch modes while recording; record on a near-full device. | Each scenario ends cleanly; partial files saved where possible; worker receives a clear message. |
| [ ] | Mobile — Offline recording: disable network, start a generic session, reconnect, upload. | Recording succeeds offline; worker prompted to assign location/task on upload; upload completes automatically. |
| [ ] | Mobile — Inactivity shut-off: leave a recording running for 15 minutes with no movement. | Recording stops automatically; worker is notified. |
| [ ] | Mobile — Crash reporting: intentionally crash the app. | Crash appears in Crashlytics or Sentry. |
| [ ] | Dashboard — Storage rules: attempt an unauthenticated file upload to /media/. | Upload is denied; authenticated upload by an authorised user succeeds. |
| [ ] | Dashboard — Permissions: call each admin endpoint with no token, wrong-role token, and valid admin token. | Returns 401, 403, and 200 respectively. |
| [ ] | Dashboard — Security headers: inspect HTTP response headers on the production domain. | X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, and CSP all present. |
| [ ] | Dashboard — Rate limiting: send 100 rapid requests to an unauthenticated endpoint. | Requests throttled after threshold; HTTP 429 returned. |

# **Path to Launch**

Supervolcano Teleops is closer to production than this report might suggest. The architecture is sound, the feature set is clear, and the vast majority of issues are straightforward engineering tasks.

This report provides a clear, prioritised roadmap:

* **Step 1:** Resolve the 7 launch blockers (P0 items).

* **Step 2:** Work through the 13 high-priority items (P1) in parallel.

* **Step 3:** Complete the pre-launch verification checklist.

* **Step 4:** Launch with confidence. Address P2 and P3 items in post-launch sprints.

Once every item on the verification checklist carries a tick, the platform is ready for real users.
