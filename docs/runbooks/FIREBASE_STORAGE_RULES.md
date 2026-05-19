# Firebase Storage — Rules and Bucket Setup

This project uses **two env-scoped Firebase Storage buckets**, both in the
single GCP project `gen-lang-client-0659584673`:

| Env     | Bucket                                           |
| ------- | ------------------------------------------------ |
| staging | `gen-lang-client-0659584673-sv-firebase-staging` |
| prod    | `gen-lang-client-0659584673-sv-firebase-prod`    |

Buckets are provisioned by Terraform (`infra/terraform/storage.tf`):

- `google_storage_bucket.buckets` — the underlying GCS bucket
- `google_firebase_storage_bucket.firebase` — registers the bucket with
  Firebase Storage so the Firebase Storage REST endpoint and client SDKs
  (`firebase/storage`, `firebasestorage.googleapis.com`) accept it

Without the Firebase registration step, the bucket exists in GCS but the
Firebase Storage REST endpoint returns 404 / "does not exist". Mobile
uploads surface this as a generic "Upload failed" toast with no
upload-progress events.

## Canonical rules file

`src/firebase/storage.rules` — single ruleset shared by both buckets.

Relevant paths:

- `media/{allPaths=**}` — authenticated read + write. Mobile video uploads
  land here at `media/<locationId>/<jobId>/<filename>`.
- `locations/{locationId}/instructions/{instructionId}/{filename}` —
  authenticated read + write for instruction images.
- `videos/{locationId}/{userId}/{filename}` — create restricted to the
  signed-in field worker, content-type must match `video/.*`.
- `orgs/{partnerOrgId}/**` — scoped to matching `partner_org_id` claim or
  admin.

When editing rules, remember Identity Platform multi-tenancy: tokens issued
to tenant users still satisfy `request.auth != null` and carry the same
custom claims (`role`, `partner_org_id`) — no tenant-aware syntax needed in
storage rules.

## Deploying rules

`firebase.json` lists both buckets explicitly:

```json
"storage": [
  { "bucket": "gen-lang-client-0659584673-sv-firebase-staging", "rules": "src/firebase/storage.rules" },
  { "bucket": "gen-lang-client-0659584673-sv-firebase-prod",    "rules": "src/firebase/storage.rules" }
]
```

The `bucket:` field is required — without it the CLI only deploys to the
project default bucket (not the buckets we use).

```bash
npx firebase-tools deploy --only storage --project gen-lang-client-0659584673
```

`.firebaserc` pins the default project alias so the `--project` flag value
matches the GCP project. If a teammate runs without the global `firebase`
CLI installed, `npx firebase-tools …` works on first run.

To deploy rules for one bucket only:

```bash
npx firebase-tools deploy --only storage:gen-lang-client-0659584673-sv-firebase-staging \
  --project gen-lang-client-0659584673
```

## Verifying setup

Bucket is Firebase-registered:

```bash
gcloud storage buckets describe gs://gen-lang-client-0659584673-sv-firebase-staging \
  --format='value(metadata.firebase)'
```

Non-empty = registered. Empty = run `terraform apply` to add the
`google_firebase_storage_bucket` resource (or call the `:addFirebase` REST
endpoint manually — see `docs/infrastructure/gcp-setup.md` §3.4).

End-to-end smoke from mobile: record a clip, watch the upload progress in
the queue screen. Failure paths:

- Generic "Upload failed" toast, no progress → bucket not Firebase-registered
  (REST 404) **or** rules missing on that bucket (deploy them).
- "Permission needed" toast → rules deployed but reject the path. Check
  `request.auth` claims and that the path matches a `match` block.
- "No internet" toast → see `mobile-app/src/utils/user-facing-error.ts` —
  triggered by error messages containing `fetch`/`network`/`offline`.

## Security notes

- `media/**` is currently authenticated-only for both read and write. If
  robot consumers move off signed URLs and need direct anonymous read, add a
  narrower public-read rule rather than widening `media/**`.
- No file-size or content-type validation in rules today. The mobile client
  sets `Content-Type: video/mp4` and enforces size at the queue layer.
  Server-side enforcement is a TODO if untrusted clients are ever added.
- Production cleanup: the dev-only `allow read, write: if true` snippet from
  the previous version of this doc has been removed. Never deploy
  open-world rules to either env — the staging bucket is publicly
  reachable via Firebase Storage REST and would be enumerable.
