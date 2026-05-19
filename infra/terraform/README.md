# Terraform — SuperVolcano GCP Foundation

Single-project, dual-env (staging + prod) infrastructure as code.

## What this manages

- All required APIs
- Default VPC peering with service networking + Serverless VPC connector
- Artifact Registry Docker repo
- Cloud Run runtime + GitHub Actions deploy service accounts (per env)
- Workload Identity Federation for keyless CI auth
- Cloud SQL Postgres instances (staging zonal, prod HA regional + PITR)
- Firestore named databases (`staging-db`, `prod-db`)
- 6 GCS buckets (videos/exports/firebase × staging/prod), with the
  `firebase-*` buckets also registered as Firebase Storage resources so the
  Firebase Storage client SDK can reach them
- Identity Platform tenants (`staging`, `prod`)
- Secret Manager entries (Postgres password populated; others empty for manual fill)
- Cloud Run services (placeholder image; CI deploys real images)
- Cloud Scheduler cron jobs (sync-sql daily, OIDC-authed to Cloud Run)

## Prerequisites

- Terraform >= 1.6
- `gcloud auth application-default login` already done
- State bucket `gen-lang-client-0659584673-tfstate` already created (one-time bootstrap, not managed by TF)
- Identity Platform initialized once via console (https://console.cloud.google.com/customer-identity)

## First-run import

The `google_compute_global_address.service_networking` resource was created
manually before TF existed. Import it before the first `apply`:

```bash
terraform init
terraform import google_compute_global_address.service_networking \
  projects/gen-lang-client-0659584673/global/addresses/google-managed-services-default
```

The Project APIs are also pre-enabled. They are idempotent — `apply` will
just take ownership without changing them.

## Usage

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

Apply takes ~15-20 min on first run (Cloud SQL prod regional ~10 min alone).

## Populating secrets after apply

Postgres passwords are auto-populated. Other secrets are created empty:

```bash
for ENV in staging prod; do
  for KEY in cron-secret admin-bearer-token robot-api-key migration-secret-key google-maps-key video-blur-processor-url video-blur-processor-key; do
    read -rsp "$ENV/$KEY: " VAL; echo
    printf %s "$VAL" | gcloud secrets versions add "${ENV}-${KEY}" --data-file=-
  done
done
```

## GitHub Actions setup

After apply, set these GitHub repo secrets (values from `terraform output`):

- `WIF_PROVIDER` — `terraform output -raw wif_provider`
- `WIF_SA_STAGING` — `terraform output -json deploy_service_accounts | jq -r .staging`
- `WIF_SA_PROD` — `terraform output -json deploy_service_accounts | jq -r .prod`
- `GCP_PROJECT_ID` — project ID

GitHub repo environment `production`: enable required reviewer protection.

## Drift detection

Run `terraform plan` periodically to detect drift. CI changes to Cloud Run
images are explicitly ignored via `lifecycle.ignore_changes`.
