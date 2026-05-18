#!/usr/bin/env bash
# Populate the 14 manual Secret Manager secrets for both envs.
#
# Auto-generates strong random values for tokens. Prompts for keys you
# already have from external services (Maps, video-blur processor).
#
# Idempotent: re-running adds a new secret version; old versions remain
# accessible. Cloud Run pulls "latest" so the new version is used on
# next revision deploy.
#
# Requires: gcloud authed, project set, roles/secretmanager.secretVersionAdder
# Run from repo root:  bash scripts/populate-secrets.sh

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-gen-lang-client-0659584673}"
echo "Project: $PROJECT_ID"
echo

add_secret() {
  local name="$1"
  local value="$2"
  printf %s "$value" | gcloud secrets versions add "$name" \
    --data-file=- --project="$PROJECT_ID" >/dev/null
  echo "  ✓ $name"
}

prompt_secret() {
  local label="$1"
  local var
  read -rsp "  $label: " var; echo
  printf %s "$var"
}

# ─── 1) Auto-generated random tokens ───────────────────────────────
echo "[1/3] Generating random tokens (auto)…"
for ENV in staging prod; do
  for KEY in cron-secret admin-bearer-token migration-secret-key robot-api-key; do
    add_secret "${ENV}-${KEY}" "$(openssl rand -base64 32 | tr -d '\n')"
  done
done
echo

# ─── 2) Google Maps API key (per env or shared) ───────────────────
echo "[2/3] Google Maps API key"
read -rp "  Use same Maps key for staging + prod? [Y/n]: " same_maps
same_maps="${same_maps:-Y}"
if [[ "$same_maps" =~ ^[Yy]$ ]]; then
  MAPS_KEY="$(prompt_secret 'Google Maps API key')"
  add_secret "staging-google-maps-key" "$MAPS_KEY"
  add_secret "prod-google-maps-key" "$MAPS_KEY"
else
  for ENV in staging prod; do
    add_secret "${ENV}-google-maps-key" "$(prompt_secret "${ENV} Maps key")"
  done
fi
echo

# ─── 3) Video Blur Processor (per env, may be unused) ─────────────
echo "[3/3] Video Blur Processor (skip with empty input if not used)"
for ENV in staging prod; do
  echo "  ${ENV}:"
  URL="$(prompt_secret '    URL (blank = skip)')"
  if [[ -n "$URL" ]]; then
    add_secret "${ENV}-video-blur-processor-url" "$URL"
    add_secret "${ENV}-video-blur-processor-key" "$(prompt_secret '    KEY')"
  else
    # Leave secret empty; Cloud Run env var maps to it but the app must
    # tolerate the empty value (current video-blur path is feature-gated).
    add_secret "${ENV}-video-blur-processor-url" "unset"
    add_secret "${ENV}-video-blur-processor-key" "unset"
    echo "    (skipped, placeholder 'unset' written)"
  fi
done

echo
echo "Done. Listing latest versions:"
gcloud secrets list --project="$PROJECT_ID" \
  --filter="name~(staging-|prod-)" \
  --format="table(name.basename(),createTime)" 2>/dev/null | head -30
