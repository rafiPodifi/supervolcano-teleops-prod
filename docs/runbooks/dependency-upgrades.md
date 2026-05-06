# Deferred Dependency Upgrades

Tracked from repo cleanup Phase B (2026-05). Each upgrade is one focused
PR with its own regression test cycle. Order suggested below.

## High-impact (do first)

### Next.js 14.2.11 → 15.x
- **Breaking:** `headers()`, `cookies()`, `params`, `searchParams` become
  async. Codemod available: `npx @next/codemod@latest next-async-request-api`.
- **Breaking:** fetch caching defaults inverted (no longer cached by
  default). Audit every `fetch()` in route handlers.
- **Watch:** App Router internals rewrites — route groups, parallel
  routes behavior subtly changed.
- Effort: 1–2 days.

### React 18.3.1 → 19
- Coordinate with Next 15 upgrade.
- New `use()` hook, `useActionState`, ref-as-prop.
- Mobile is already on React 19 via Expo SDK 54 — keeping web at 18
  causes type drift across shared types.
- Effort: 0.5 day after Next 15.

## Medium-impact

### firebase-admin 11.11.1 → 12.x (root)
- Functions/ already on 12 — root version inconsistency causes
  ambient-types confusion.
- 12.x drops Node 14 support, introduces FieldValue type changes.
- Effort: 0.5 day.

### firebase 11 → 12 (web client)
- Mobile is already on 12.6.0 — coordinate to align SDKs.
- Auth persistence API mostly stable; check `onIdTokenChanged` migration.
- Effort: 0.5 day with auth regression suite.

## Low-impact

### Firebase Functions Node 18 → 20
- `functions/package.json` engines: 18. Firebase deprecated 18 runtime.
- No code changes expected.
- Effort: 1 hour + redeploy.

### Zod 4.1.x patch updates
- Already on 4.x stream; just keep current.

## Won't-do (intentional split)

- React Native version (mobile): governed by Expo SDK; bumps with Expo
  SDK upgrade only.
- Hermes: enable later as part of perf work, not deps cleanup.
