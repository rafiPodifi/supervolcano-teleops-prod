# GCP Setup Runbook

Single-project, dual-env (staging + prod) GCP migration.
Reference: `~/.claude/plans/i-need-to-plan-fluttering-lovelace.md`.

## Prerequisites

```bash
# Install gcloud CLI (macOS)
brew install --cask google-cloud-sdk

# Auth
gcloud auth login
gcloud auth application-default login

# Set project (replace with client-provided ID)
export PROJECT_ID="<client-project-id>"
export REGION="us-west1"
gcloud config set project "$PROJECT_ID"
gcloud config set run/region "$REGION"
gcloud config set compute/region "$REGION"
```

Convention used below: shell vars `$PROJECT_ID`, `$REGION` set once and reused.

---

## Phase 2 — Project foundations

### 2.1 Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  vpcaccess.googleapis.com \
  servicenetworking.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  storage.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com
```

### 2.2 VPC + Serverless VPC connector

```bash
# Default VPC usually exists. If not, create:
gcloud compute networks create default --subnet-mode=auto 2>/dev/null || true

# Allocate /20 IP range for service networking (Cloud SQL private IP)
gcloud compute addresses create google-managed-services-default \
  --global --purpose=VPC_PEERING --prefix-length=16 \
  --network=default

# Peer with service networking (one-time, takes ~3 min)
gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges=google-managed-services-default \
  --network=default

# Serverless VPC connector for Cloud Run → private resources
gcloud compute networks vpc-access connectors create vpc-conn-usw1 \
  --region=$REGION --network=default \
  --range=10.8.0.0/28 \
  --min-instances=2 --max-instances=10
```

### 2.3 Artifact Registry

```bash
gcloud artifacts repositories create supervolcano \
  --repository-format=docker \
  --location=$REGION \
  --description="SuperVolcano container images"
```

### 2.4 Service accounts + IAM

```bash
# Cloud Run runtime SAs (one per env)
for ENV in staging prod; do
  gcloud iam service-accounts create cr-$ENV \
    --display-name="Cloud Run runtime ($ENV)"
done

# Grant per-env IAM
for ENV in staging prod; do
  SA="cr-$ENV@${PROJECT_ID}.iam.gserviceaccount.com"
  for ROLE in \
    roles/cloudsql.client \
    roles/datastore.user \
    roles/storage.objectAdmin \
    roles/secretmanager.secretAccessor \
    roles/firebaseauth.admin \
    roles/logging.logWriter \
    roles/monitoring.metricWriter \
    roles/cloudtrace.agent
  do
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:$SA" --role="$ROLE" --condition=None
  done
done

# CI deploy SAs (one per env)
for ENV in staging prod; do
  gcloud iam service-accounts create gha-deploy-$ENV \
    --display-name="GitHub Actions deploy ($ENV)"
  SA="gha-deploy-$ENV@${PROJECT_ID}.iam.gserviceaccount.com"
  for ROLE in \
    roles/run.developer \
    roles/artifactregistry.writer \
    roles/iam.serviceAccountUser \
    roles/cloudsql.client \
    roles/firebaserules.admin
  do
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:$SA" --role="$ROLE" --condition=None
  done
done
```

### 2.5 Workload Identity Federation (GitHub Actions keyless auth)

```bash
# Get GitHub repo (replace owner/repo)
export GH_REPO="rafiPodifi/supervolcano-teleops-prod"

# Create pool
gcloud iam workload-identity-pools create github-pool \
  --location=global --display-name="GitHub Actions"

export POOL_ID=$(gcloud iam workload-identity-pools describe github-pool \
  --location=global --format="value(name)")

# Provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global --workload-identity-pool=github-pool \
  --display-name="GitHub OIDC" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='${GH_REPO}'" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Bind GHA SAs to repo branch/tag claims
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Staging: main branch
gcloud iam service-accounts add-iam-policy-binding \
  gha-deploy-staging@${PROJECT_ID}.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.ref/refs/heads/main"

# Prod: tag refs/tags/v*
gcloud iam service-accounts add-iam-policy-binding \
  gha-deploy-prod@${PROJECT_ID}.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.ref/refs/tags/v*"

# Print provider name for GitHub Actions secret
echo "WIF_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
```

---

## Phase 3 — Data plane

### 3.1 Cloud SQL Postgres (two instances)

```bash
# Generate strong passwords (store in Secret Manager later)
export STAGING_PG_PW=$(openssl rand -base64 32)
export PROD_PG_PW=$(openssl rand -base64 32)

# Staging: zonal, cheap
gcloud sql instances create sv-sql-staging \
  --database-version=POSTGRES_16 \
  --tier=db-g1-small \
  --region=$REGION \
  --availability-type=ZONAL \
  --network=projects/${PROJECT_ID}/global/networks/default \
  --no-assign-ip \
  --backup-start-time=09:00 \
  --root-password="$STAGING_PG_PW"

# Prod: HA regional, PITR, deletion protection
gcloud sql instances create sv-sql-prod \
  --database-version=POSTGRES_16 \
  --tier=db-custom-2-7680 \
  --region=$REGION \
  --availability-type=REGIONAL \
  --network=projects/${PROJECT_ID}/global/networks/default \
  --no-assign-ip \
  --enable-point-in-time-recovery \
  --backup-start-time=09:00 \
  --retained-backups-count=14 \
  --retained-transaction-log-days=7 \
  --deletion-protection \
  --root-password="$PROD_PG_PW"

# Create app DB + user per instance
for ENV in staging prod; do
  INST="sv-sql-$ENV"
  PW_VAR=$(echo "${ENV}_PG_PW" | tr a-z A-Z)
  gcloud sql databases create supervolcano --instance=$INST
  gcloud sql users create app_$ENV --instance=$INST --password="${!PW_VAR}"
done

# Capture connection names for env vars
gcloud sql instances describe sv-sql-staging --format="value(connectionName)"
gcloud sql instances describe sv-sql-prod    --format="value(connectionName)"
```

### 3.2 Firestore named databases

```bash
# Staging DB
gcloud firestore databases create \
  --database=staging-db \
  --location=$REGION \
  --type=firestore-native

# Prod DB
gcloud firestore databases create \
  --database=prod-db \
  --location=$REGION \
  --type=firestore-native \
  --delete-protection

# Deploy rules to both (run from repo root)
firebase deploy --only firestore:rules --project $PROJECT_ID -- \
  --database=staging-db
firebase deploy --only firestore:rules --project $PROJECT_ID -- \
  --database=prod-db
```

Note: Firebase CLI multi-database support requires `firebase.json` updated
with `firestore` array entries — see `firebase.json` change in Phase 8.

### 3.3 GCS buckets (6 total)

```bash
for ENV in staging prod; do
  for BUCKET in videos exports firebase; do
    NAME="sv-${BUCKET}-${ENV}"
    gcloud storage buckets create gs://$NAME \
      --location=$REGION \
      --uniform-bucket-level-access \
      --public-access-prevention
  done
done

# Prod: versioning + retention lock
for BUCKET in videos exports firebase; do
  NAME="sv-${BUCKET}-prod"
  gcloud storage buckets update gs://$NAME --versioning
  gcloud storage buckets update gs://$NAME \
    --retention-period=30d
done

# Staging: lifecycle delete >30 days
cat > /tmp/staging-lifecycle.json <<'EOF'
{
  "lifecycle": {
    "rule": [
      { "action": {"type": "Delete"}, "condition": {"age": 30} }
    ]
  }
}
EOF
for BUCKET in videos exports firebase; do
  gcloud storage buckets update gs://sv-${BUCKET}-staging \
    --lifecycle-file=/tmp/staging-lifecycle.json
done

# CORS for Firebase Storage buckets (allow Cloud Run origins)
cat > /tmp/cors.json <<'EOF'
[{"origin": ["*"], "method": ["GET", "HEAD"], "responseHeader": ["Content-Type"], "maxAgeSeconds": 3600}]
EOF
gcloud storage buckets update gs://sv-firebase-staging --cors-file=/tmp/cors.json
gcloud storage buckets update gs://sv-firebase-prod    --cors-file=/tmp/cors.json
```

---

## Phase 4 — Identity Platform tenants

```bash
# Enable Identity Platform (one-time, may need console click)
# https://console.cloud.google.com/customer-identity?project=$PROJECT_ID

# Create tenants via REST (no gcloud command exists)
ACCESS_TOKEN=$(gcloud auth print-access-token)

for ENV in staging prod; do
  curl -sS -X POST \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/tenants" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"displayName\": \"${ENV}\", \"allowPasswordSignup\": true}" \
    | jq '.name, .tenantId'
done

# Note tenant IDs returned. They look like "staging-abc123" or numeric.
# Capture into env: STAGING_TENANT_ID, PROD_TENANT_ID
```

---

## Phase 5 — Secret Manager

```bash
# Helper: create secret from prompt
add_secret() {
  local NAME=$1
  read -rsp "Value for $NAME: " VAL; echo
  printf %s "$VAL" | gcloud secrets create "$NAME" --data-file=- 2>/dev/null \
    || printf %s "$VAL" | gcloud secrets versions add "$NAME" --data-file=-
}

# Staging-prefixed secrets
for SECRET in \
  staging-cron-secret \
  staging-admin-bearer-token \
  staging-robot-api-key \
  staging-migration-secret-key \
  staging-google-maps-key \
  staging-video-blur-processor-url \
  staging-video-blur-processor-key
do
  add_secret "$SECRET"
done
echo -n "$STAGING_PG_PW" | gcloud secrets create staging-postgres-password --data-file=-

# Prod-prefixed secrets
for SECRET in \
  prod-cron-secret \
  prod-admin-bearer-token \
  prod-robot-api-key \
  prod-migration-secret-key \
  prod-google-maps-key \
  prod-video-blur-processor-url \
  prod-video-blur-processor-key
do
  add_secret "$SECRET"
done
echo -n "$PROD_PG_PW" | gcloud secrets create prod-postgres-password --data-file=-

# Grant Cloud Run SAs access to their env's secrets only
for ENV in staging prod; do
  SA="cr-$ENV@${PROJECT_ID}.iam.gserviceaccount.com"
  for SECRET in $(gcloud secrets list --filter="name~${ENV}-" --format="value(name)"); do
    gcloud secrets add-iam-policy-binding "$SECRET" \
      --member="serviceAccount:$SA" \
      --role="roles/secretmanager.secretAccessor"
  done
done
```

---

## Phase 6 — First Cloud Run deploy (staging)

```bash
# Build + push image
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/supervolcano/web:$(git rev-parse --short HEAD)"
gcloud builds submit --tag "$IMAGE" .

# Get connection names
STAGING_CONN=$(gcloud sql instances describe sv-sql-staging --format="value(connectionName)")

# Deploy staging
gcloud run deploy supervolcano-web-staging \
  --image="$IMAGE" \
  --region=$REGION \
  --service-account="cr-staging@${PROJECT_ID}.iam.gserviceaccount.com" \
  --vpc-connector=vpc-conn-usw1 \
  --vpc-egress=private-ranges-only \
  --add-cloudsql-instances="$STAGING_CONN" \
  --min-instances=0 --max-instances=5 \
  --memory=512Mi --cpu=1 \
  --port=8080 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_PROJECT_ID=${PROJECT_ID}" \
  --set-env-vars="FIRESTORE_DATABASE_ID=staging-db" \
  --set-env-vars="NEXT_PUBLIC_AUTH_TENANT_ID=${STAGING_TENANT_ID}" \
  --set-env-vars="DATABASE_URL=postgresql://app_staging@/supervolcano?host=/cloudsql/${STAGING_CONN}" \
  --update-secrets="POSTGRES_PASSWORD=staging-postgres-password:latest" \
  --update-secrets="ADMIN_BEARER_TOKEN=staging-admin-bearer-token:latest" \
  --update-secrets="ROBOT_API_KEY=staging-robot-api-key:latest" \
  --update-secrets="MIGRATION_SECRET_KEY=staging-migration-secret-key:latest" \
  --update-secrets="NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=staging-google-maps-key:latest" \
  --update-secrets="VIDEO_BLUR_PROCESSOR_URL=staging-video-blur-processor-url:latest" \
  --update-secrets="VIDEO_BLUR_PROCESSOR_KEY=staging-video-blur-processor-key:latest"

# Note the service URL
gcloud run services describe supervolcano-web-staging \
  --region=$REGION --format="value(status.url)"
```

Repeat for prod with `--min-instances=1 --max-instances=20 --memory=1Gi`,
prod connection name, prod tenant, prod-\* secrets.

---

## Phase 7 — Cloud Scheduler (cron)

```bash
STAGING_URL=$(gcloud run services describe supervolcano-web-staging \
  --region=$REGION --format="value(status.url)")

# OIDC-authenticated scheduler invoking Cloud Run
gcloud scheduler jobs create http sync-sql-staging \
  --location=$REGION \
  --schedule="0 0 * * *" \
  --uri="${STAGING_URL}/api/cron/sync-sql" \
  --http-method=POST \
  --oidc-service-account-email="cr-staging@${PROJECT_ID}.iam.gserviceaccount.com" \
  --oidc-token-audience="${STAGING_URL}"

# Drive sync (15 min) — only if /functions/googleDriveSync needs HTTP trigger
# Otherwise stays as a Firebase Functions scheduled function
```

Repeat for prod with prod URL + prod SA.

---

## Phase 8 — Firebase Functions per env

Update `firebase.json` codebase config (committed in repo):

```json
{
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "runtime": "nodejs20"
    }
  ],
  "firestore": [
    { "database": "staging-db", "rules": "src/firebase/firestore.rules" },
    { "database": "prod-db", "rules": "src/firebase/firestore.rules" }
  ]
}
```

Deploy:

```bash
firebase use $PROJECT_ID
firebase deploy --only functions
firebase deploy --only firestore:rules
```

---

## Phase 9 — CI/CD GitHub Actions

See `.github/workflows/deploy-staging.yml` and `deploy-prod.yml` (committed).

GitHub repo secrets needed:

- `WIF_PROVIDER` — value printed in 2.5
- `WIF_SA_STAGING` — `gha-deploy-staging@${PROJECT_ID}.iam.gserviceaccount.com`
- `WIF_SA_PROD` — `gha-deploy-prod@${PROJECT_ID}.iam.gserviceaccount.com`
- `GCP_PROJECT_ID` — `$PROJECT_ID`

GitHub repo environment `production`: enable required reviewer protection.

---

## Phase 10-12 — Observability, mobile flavors, cutover

See plan file `~/.claude/plans/i-need-to-plan-fluttering-lovelace.md`.
