resource "random_password" "postgres" {
  for_each = var.envs_set

  length  = 32
  special = true
  # avoid ambiguous chars in connection strings
  override_special = "!@#%^*-_=+"
}

resource "google_sql_database_instance" "main" {
  for_each = var.envs_set

  name                = "sv-sql-${each.key}"
  database_version    = "POSTGRES_16"
  region              = var.region
  deletion_protection = local.env_config[each.key].sql_deletion_protect

  settings {
    tier              = local.env_config[each.key].sql_tier
    availability_type = local.env_config[each.key].sql_availability
    disk_autoresize   = true
    disk_type         = "PD_SSD"
    disk_size         = 10

    backup_configuration {
      enabled                        = local.env_config[each.key].sql_backups_enabled
      start_time                     = "09:00"
      point_in_time_recovery_enabled = local.env_config[each.key].sql_pitr
      backup_retention_settings {
        retained_backups = local.env_config[each.key].sql_backups_retained
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = data.google_compute_network.default.id
      enable_private_path_for_google_cloud_services = true
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = false
      record_client_address   = false
    }

    maintenance_window {
      day  = 7 # Sunday
      hour = 10
    }
  }

  depends_on = [
    google_project_service.apis,
    google_service_networking_connection.private_vpc,
  ]

  lifecycle {
    ignore_changes = [settings[0].disk_size]
  }
}

resource "google_sql_database" "supervolcano" {
  for_each = var.envs_set

  name     = "supervolcano"
  instance = google_sql_database_instance.main[each.key].name
}

resource "google_sql_user" "app" {
  for_each = var.envs_set

  name     = "app_${each.key}"
  instance = google_sql_database_instance.main[each.key].name
  password = random_password.postgres[each.key].result
}
