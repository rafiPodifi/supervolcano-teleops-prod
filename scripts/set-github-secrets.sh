#!/usr/bin/env bash
# Push all GitHub Actions repo secrets needed by the deploy workflows.
#
# Requires: gh CLI authenticated against rafiPodifi/supervolcano-teleops-prod.
# Run from repo root:  bash scripts/set-github-secrets.sh
#
# All values are baked into either the Docker image (NEXT_PUBLIC_*) or the
# Cloud Run env / IAM federation step. Re-run to rotate any value.

set -euo pipefail

REPO="rafiPodifi/supervolcano-teleops-prod"
PROJECT_ID="gen-lang-client-0659584673"
PROJECT_NUMBER="1052457016242"

# ─── Shared (across envs) ────────────────────────────────────────
FIREBASE_API_KEY="AIzaSyAb2dNHcpU2NpDRZyIQ0PXv1s72GeKQh7Y"
FIREBASE_AUTH_DOMAIN="gen-lang-client-0659584673.firebaseapp.com"
FIREBASE_MESSAGING_SENDER_ID="1052457016242"

# ─── Per-env appId (from Firebase console) ───────────────────────
STAGING_FIREBASE_APP_ID="1:1052457016242:web:00e7894660e0b103fde2ab"
PROD_FIREBASE_APP_ID="1:1052457016242:web:22a98e49d1f6d648fde2ab"

# ─── Per-env Identity Platform tenant IDs (from terraform output) ─
STAGING_AUTH_TENANT_ID="staging-ita88"
PROD_AUTH_TENANT_ID="prod-ftn50"

# ─── Google Maps API key (prompt — same for both envs is fine) ───
read -rsp "Google Maps API key: " MAPS_KEY; echo

set_secret() {
  local name="$1"
  local value="$2"
  printf %s "$value" | gh secret set "$name" --repo "$REPO" --body -
  echo "  ✓ $name"
}

echo
echo "Pushing secrets to $REPO …"

# Shared
set_secret "GCP_PROJECT_ID" "$PROJECT_ID"

# WIF
set_secret "WIF_PROVIDER_STAGING" \
  "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-staging"
set_secret "WIF_PROVIDER_PROD" \
  "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-prod"
set_secret "WIF_SA_STAGING" "gha-deploy-staging@${PROJECT_ID}.iam.gserviceaccount.com"
set_secret "WIF_SA_PROD"    "gha-deploy-prod@${PROJECT_ID}.iam.gserviceaccount.com"

# Identity Platform tenant IDs
set_secret "STAGING_AUTH_TENANT_ID" "$STAGING_AUTH_TENANT_ID"
set_secret "PROD_AUTH_TENANT_ID"    "$PROD_AUTH_TENANT_ID"

# Firebase web SDK (per env appId, shared everything else)
for ENV in STAGING PROD; do
  APP_ID_VAR="${ENV}_FIREBASE_APP_ID"
  set_secret "${ENV}_FIREBASE_API_KEY"             "$FIREBASE_API_KEY"
  set_secret "${ENV}_FIREBASE_AUTH_DOMAIN"         "$FIREBASE_AUTH_DOMAIN"
  set_secret "${ENV}_FIREBASE_MESSAGING_SENDER_ID" "$FIREBASE_MESSAGING_SENDER_ID"
  set_secret "${ENV}_FIREBASE_APP_ID"              "${!APP_ID_VAR}"
  set_secret "${ENV}_GOOGLE_MAPS_API_KEY"          "$MAPS_KEY"
done

echo
echo "Done. Verify with:"
echo "  gh secret list --repo $REPO"
