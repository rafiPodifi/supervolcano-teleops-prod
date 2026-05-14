# Cloud Run runtime SAs (one per env). Granted minimum data-plane access.
resource "google_service_account" "cloud_run" {
  for_each = var.envs_set

  account_id   = "cr-${each.key}"
  display_name = "Cloud Run runtime (${each.key})"

  depends_on = [google_project_service.apis]
}

locals {
  # run.invoker is intentionally NOT here: it must be granted per-service
  # to avoid cross-env invocation. See cloud_run.tf for per-service binding
  # of the scheduler SA.
  cloud_run_roles = [
    "roles/cloudsql.client",
    "roles/datastore.user",
    "roles/firebaseauth.admin",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/cloudtrace.agent",
  ]

  cloud_run_role_bindings = {
    for pair in setproduct(tolist(var.envs_set), local.cloud_run_roles) :
    "${pair[0]}-${pair[1]}" => { env = pair[0], role = pair[1] }
  }
}

resource "google_project_iam_member" "cloud_run_roles" {
  for_each = local.cloud_run_role_bindings

  project = var.project_id
  role    = each.value.role
  member  = "serviceAccount:${google_service_account.cloud_run[each.value.env].email}"
}

# CI deploy SAs (one per env) — used via Workload Identity Federation.
resource "google_service_account" "deploy" {
  for_each = var.envs_set

  account_id   = "gha-deploy-${each.key}"
  display_name = "GitHub Actions deploy (${each.key})"

  depends_on = [google_project_service.apis]
}

locals {
  # iam.serviceAccountUser is intentionally NOT project-wide: it would let
  # staging CI impersonate any SA including cr-prod. We grant the narrow
  # impersonation right per-runtime-SA via deploy_uses_runtime below.
  deploy_roles = [
    "roles/run.developer",
    "roles/artifactregistry.writer",
    "roles/cloudsql.client",
    "roles/firebaserules.admin",
    "roles/datastore.indexAdmin",
    # firebase-tools deploy needs serviceusage.services.get to verify APIs
    # are enabled before pushing rules.
    "roles/serviceusage.serviceUsageConsumer",
  ]

  deploy_role_bindings = {
    for pair in setproduct(tolist(var.envs_set), local.deploy_roles) :
    "${pair[0]}-${pair[1]}" => { env = pair[0], role = pair[1] }
  }
}

resource "google_project_iam_member" "deploy_roles" {
  for_each = local.deploy_role_bindings

  project = var.project_id
  role    = each.value.role
  member  = "serviceAccount:${google_service_account.deploy[each.value.env].email}"
}

# Allow Cloud Run runtime SAs to act as themselves so deploy SAs can deploy
# revisions that use them.
resource "google_service_account_iam_member" "deploy_uses_runtime" {
  for_each = var.envs_set

  service_account_id = google_service_account.cloud_run[each.key].name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy[each.key].email}"
}
