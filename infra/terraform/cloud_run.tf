# Full Postgres DSN (with password) — stored as a Secret per env so it
# never appears in plain Cloud Run env vars or TF outputs.
resource "google_secret_manager_secret" "database_url" {
  for_each = var.envs_set

  secret_id = "${each.key}-database-url"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "database_url" {
  for_each = var.envs_set

  secret      = google_secret_manager_secret.database_url[each.key].id
  secret_data = "postgresql://app_${each.key}:${random_password.postgres[each.key].result}@/supervolcano?host=/cloudsql/${google_sql_database_instance.main[each.key].connection_name}"
}

resource "google_secret_manager_secret_iam_member" "runtime_access_database_url" {
  for_each = var.envs_set

  secret_id = google_secret_manager_secret.database_url[each.key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run[each.key].email}"
}

# Cloud Run services — placeholder image at create time. CI deploys real
# images after first apply. lifecycle.ignore_changes covers the entire
# template block because indexed paths (template[0].containers[0].image)
# are unreliable in provider 6.x.
resource "google_cloud_run_v2_service" "web" {
  for_each = var.envs_set

  name     = "supervolcano-web-${each.key}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloud_run[each.key].email

    scaling {
      min_instance_count = local.env_config[each.key].run_min_instances
      max_instance_count = local.env_config[each.key].run_max_instances
    }

    vpc_access {
      # Explicit full path; .id sometimes returns short form which v2 API rejects.
      connector = "projects/${var.project_id}/locations/${var.region}/connectors/${google_vpc_access_connector.primary.name}"
      egress    = "PRIVATE_RANGES_ONLY"
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main[each.key].connection_name]
      }
    }

    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"
      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = local.env_config[each.key].run_cpu
          memory = local.env_config[each.key].run_memory
        }
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name  = "FIRESTORE_DATABASE_ID"
        value = "${each.key}-db"
      }
      env {
        name  = "FIREBASE_STORAGE_BUCKET"
        value = google_storage_bucket.buckets["firebase-${each.key}"].name
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url[each.key].secret_id
            version = "latest"
          }
        }
      }
      # NOTE: NEXT_PUBLIC_* values are baked into the image at build time
      # (Next.js inlines them). They are passed as --build-arg by the CI
      # workflows, not as Cloud Run env vars. See .github/workflows.

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
    }
  }

  lifecycle {
    # CI deploys via `gcloud run deploy` will update image + arbitrary other
    # template fields. Ignore the whole template after creation; TF only
    # owns the resource shell.
    ignore_changes = [
      template,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_sql_database.supervolcano,
    google_sql_user.app,
    google_secret_manager_secret_version.postgres_password,
    google_secret_manager_secret_version.database_url,
  ]
}

# Public access on prod only. Staging is hidden behind authenticated
# invoker — testers impersonate cr-staging via gcloud or curl with an
# identity token.
resource "google_cloud_run_v2_service_iam_member" "public_prod" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.web["prod"].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Scheduler (per env) needs invoker on its own service.
resource "google_cloud_run_v2_service_iam_member" "scheduler_invoker" {
  for_each = var.envs_set

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.web[each.key].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.cloud_run[each.key].email}"
}
