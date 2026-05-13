# Workload Identity Federation for keyless GitHub Actions auth.
# Two providers: one gated to main-branch (staging deploys), one gated to
# refs/tags/v* (prod deploys). principalSet path supports only equality, so
# the staging provider uses an exact attribute-ref match while the prod
# provider uses startsWith() on the assertion ref. Each deploy SA is bound
# to its corresponding provider only.
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Actions"

  depends_on = [google_project_service.apis]
}

locals {
  wif_attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }
}

resource "google_iam_workload_identity_pool_provider" "github_staging" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-staging"
  display_name                       = "GitHub OIDC (staging)"

  attribute_mapping   = local.wif_attribute_mapping
  attribute_condition = "assertion.repository == \"${var.github_repo}\" && assertion.ref == \"refs/heads/main\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_iam_workload_identity_pool_provider" "github_prod" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-prod"
  display_name                       = "GitHub OIDC (prod)"

  attribute_mapping   = local.wif_attribute_mapping
  attribute_condition = "assertion.repository == \"${var.github_repo}\" && assertion.ref.startsWith(\"refs/tags/v\")"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "wif_staging" {
  service_account_id = google_service_account.deploy["staging"].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${local.project_number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github.workload_identity_pool_id}/attribute.repository/${var.github_repo}"
}

resource "google_service_account_iam_member" "wif_prod" {
  service_account_id = google_service_account.deploy["prod"].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${local.project_number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github.workload_identity_pool_id}/attribute.repository/${var.github_repo}"
}
