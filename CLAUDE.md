# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This is a monorepo with three components:

- **`/src`** — Next.js 14 (App Router) web dashboard (root-level Next.js project)
- **`/mobile-app`** — Expo/React Native Android app for field workers
- **`/functions`** — Firebase Cloud Functions

---

## Web Dashboard Commands

Run from the repository root.

```bash
pnpm run dev         # Start Next.js dev server (localhost:3000)
pnpm run build       # Type-check + production build
pnpm run lint        # ESLint (next/core-web-vitals)
pnpm run format      # Prettier across all files

# Admin utilities (run against live Firebase)
pnpm run set-admin                            # Promote user to admin
pnpm run create:org-manager <email> <pw>      # Create an org manager
pnpm run create:teleoperator <email> <pw> <orgId>
pnpm run assign:manager "<org name>" <email> <pw>
pnpm run db:schema                            # Apply PostgreSQL schema
pnpm run deploy-rules                         # Deploy Firebase security rules
```

Both the web project and `mobile-app/` use pnpm (pinned via `packageManager`
field). Run `corepack enable` once so the pinned pnpm version is used
automatically. `functions/` still uses npm — pnpm migration there is
tracked separately.

There are no automated tests. `pnpm run build` is the closest to a CI check.

---

## Mobile App Commands

Run from `mobile-app/`.

```bash
pnpm exec expo start            # Start Expo dev server (requires Expo Go or dev client)
pnpm exec expo start --tunnel   # Tunnel mode for physical device on different network
pnpm exec expo run:android      # Build and run on connected Android device/emulator

# EAS cloud builds
pnpm run eas:build:android   # Android preview build via EAS
pnpm run eas:build:ios       # iOS preview build via EAS
pnpm run eas:update          # OTA update to preview branch
```

The mobile app uses a **custom dev client** (not plain Expo Go) because it includes the native `ExternalCamera` module. After dependency changes, rebuild the dev client.

---

## Architecture

### Database Rules (Critical)

The platform uses a dual-database architecture. **Never mix these:**

| Consumer                                                                         | Database       | How to access                                   |
| -------------------------------------------------------------------------------- | -------------- | ----------------------------------------------- |
| All human-facing endpoints (`/api/admin/*`, `/api/org/*`, `/api/mobile/*`, etc.) | **Firestore**  | `import { adminDb } from '@/lib/firebaseAdmin'` |
| Robot endpoints only (`/api/robot/v1/*`)                                         | **PostgreSQL** | `import { sql } from '@/lib/db/postgres'`       |

PostgreSQL is a read-only replica synced from Firestore via a scheduled job (`/api/cron/sync-sql`, runs daily). Never write to PostgreSQL from application code. Never query PostgreSQL from admin/org endpoints.

### Web Portals

Three distinct portals within the same Next.js app:

- **`/admin`** — SuperVolcano internal team (`admin`, `superadmin` roles). Full platform management.
- **`/org`** — Customer organizations. Shared by managers and field workers with role-filtered views.
- **`/api/robot/v1/*`** — Robot Intelligence API. PostgreSQL-backed only.

Root `/` redirects to `/login` (configured in `next.config.mjs`).

### Role System

Six roles across two business models:

**B2B (OEM Robotics Testing):**

- `admin` / `superadmin` — org: `sv:internal`
- `partner_manager` — org: `oem:<company-slug>`, cannot create locations
- `oem_teleoperator` — mobile-only field worker

**B2C (Property Management):**

- `location_owner` — org: `owner:<slug>`, creates and owns their own properties
- `location_cleaner` — mobile-only field worker

Permission enforcement is centralised in `src/lib/auth/permissions.ts`. Use `requirePermission(user, 'PERMISSION_NAME')` in API routes to enforce access. All GET endpoints filter data based on role — see `docs/architecture/ARCHITECTURE.md` for the role-scoping patterns.

### Web Data Layer

- **Repositories** at `src/lib/repositories/` — all Firestore data access goes through here
- **Validation** at `src/lib/validation/` — Zod schemas for all API input
- **Firebase Admin** at `src/lib/firebaseAdmin.ts` — server-side Firestore client (`adminDb`)
- **Firebase Client** at `src/lib/firebase/` — client-side SDK (used in browser components)
- Import alias `@/*` maps to `src/*`

### Mobile App Architecture

The app uses **role-based navigation**: `AppNavigator` → `CleanerNavigator` / `MemberNavigator` / `OwnerNavigator` depending on the authenticated user's role.

**External camera native module** (`mobile-app/src/native/external-camera.ts`) is a JS bridge to the custom Android native module for USB UVC cameras. All external camera state is managed through the `useExternalCameraDiagnostics` hook (`mobile-app/src/hooks/useExternalCameraDiagnostics.ts`), which surfaces `connectionStatus`, `supportState`, `sessionState`, `isReady`, `isConnectionTimedOut`, and methods like `retryPreview()` and `resetConnectionTimeout()`.

Key state tracking pattern in `MemberRecordScreen`: mode and recording state are mirrored into refs (`isExternalModeRef`, `isExternalReadyRef`, `isRecordingRef`) so they can be safely read from event listener callbacks without stale closures.

### Firebase Security Rules

- Firestore rules: `src/firebase/firestore.rules`
- Storage rules: `src/firebase/storage.rules`

Deploy with: `firebase deploy --only firestore:rules,storage:rules --project <project-id>`

Or via the pnpm script: `pnpm run deploy-rules`

### Environment

The web dashboard requires a `.env.local` at the root with Firebase client config (`NEXT_PUBLIC_FIREBASE_*`), Firebase Admin SDK credentials (`FIREBASE_ADMIN_*`), PostgreSQL connection (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DATABASE`), and `CRON_SECRET`. See `README.md` for the full variable list.

The mobile app connects to the same Firebase project. Firebase config is at `mobile-app/src/config/firebase.ts`.
