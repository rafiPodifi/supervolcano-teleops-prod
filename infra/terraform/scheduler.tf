resource "google_cloud_scheduler_job" "sync_sql" {
  for_each = var.envs_set

  name        = "sync-sql-${each.key}"
  description = "Daily Firestore -> Cloud SQL sync (${each.key})"
  schedule    = "0 0 * * *"
  time_zone   = "UTC"
  region      = var.region

  http_target {
    http_method = "POST"
    uri         = "${trimsuffix(google_cloud_run_v2_service.web[each.key].uri, "/")}/api/cron/sync-sql"

    oidc_token {
      service_account_email = google_service_account.cloud_run[each.key].email
      # Must match the CRON_AUDIENCE env var on the Cloud Run service —
      # trim any trailing slash so the audience string is canonical.
      audience = trimsuffix(google_cloud_run_v2_service.web[each.key].uri, "/")
    }
  }

  retry_config {
    retry_count = 3
  }

  depends_on = [google_project_service.apis]
}
