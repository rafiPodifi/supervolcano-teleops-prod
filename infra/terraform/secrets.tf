locals {
  # Secrets created empty; populate values manually after apply.
  # Postgres password is set programmatically below.
  manual_secret_keys = [
    "cron-secret",
    "admin-bearer-token",
    "robot-api-key",
    "migration-secret-key",
    "google-maps-key",
    "video-blur-processor-url",
    "video-blur-processor-key",
  ]

  secrets_matrix = {
    for pair in setproduct(tolist(var.envs_set), local.manual_secret_keys) :
    "${pair[0]}-${pair[1]}" => { env = pair[0], key = pair[1] }
  }
}

resource "google_secret_manager_secret" "manual" {
  for_each = local.secrets_matrix

  secret_id = "${each.value.env}-${each.value.key}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

# Cloud Run runtime SA can read its own env's secrets only.
resource "google_secret_manager_secret_iam_member" "runtime_access_manual" {
  for_each = local.secrets_matrix

  secret_id = google_secret_manager_secret.manual[each.key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run[each.value.env].email}"
}

# Postgres password — TF-managed, value pushed automatically.
resource "google_secret_manager_secret" "postgres_password" {
  for_each = var.envs_set

  secret_id = "${each.key}-postgres-password"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "postgres_password" {
  for_each = var.envs_set

  secret      = google_secret_manager_secret.postgres_password[each.key].id
  secret_data = random_password.postgres[each.key].result
}

resource "google_secret_manager_secret_iam_member" "runtime_access_postgres" {
  for_each = var.envs_set

  secret_id = google_secret_manager_secret.postgres_password[each.key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run[each.key].email}"
}
