# APIs are already enabled (see Phase 2.1 in docs/infrastructure/gcp-setup.md).
# Tracking them here as imported resources keeps them under TF control and
# prevents accidental disable.

locals {
  required_apis = [
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "firestore.googleapis.com",
    "identitytoolkit.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudscheduler.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "vpcaccess.googleapis.com",
    "servicenetworking.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "storage.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "compute.googleapis.com",
    "firebaserules.googleapis.com",
    "firebasestorage.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.required_apis)

  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}
