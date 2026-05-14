provider "google" {
  project               = var.project_id
  region                = var.region
  billing_project       = var.project_id
  user_project_override = true
}

provider "google-beta" {
  project               = var.project_id
  region                = var.region
  billing_project       = var.project_id
  user_project_override = true
}

data "google_project" "this" {
  project_id = var.project_id
}

locals {
  project_number = data.google_project.this.number

  # Per-env config in one place. Used across cloudsql, run, secrets, etc.
  env_config = {
    staging = {
      sql_tier              = "db-g1-small"
      sql_availability      = "ZONAL"
      sql_pitr              = false
      sql_deletion_protect  = false
      sql_backups_enabled   = false
      sql_backups_retained  = 7
      run_min_instances     = 0
      run_max_instances     = 5
      run_memory            = "512Mi"
      run_cpu               = "1"
      bucket_versioning     = false
      bucket_retention_days = 30
    }
    prod = {
      # Balanced scenario per customer-approved
      # docs/product/Infrastructure-Cost-Options.docx (Option C).
      # Scale to db-custom-2-7680 (Option E) when load justifies.
      sql_tier              = "db-custom-1-3840"
      sql_availability      = "REGIONAL"
      sql_pitr              = true
      sql_deletion_protect  = true
      sql_backups_enabled   = true
      sql_backups_retained  = 14
      run_min_instances     = 1
      run_max_instances     = 20
      run_memory            = "1Gi"
      run_cpu               = "1"
      bucket_versioning     = true
      bucket_retention_days = 0 # retention via versioning, no lifecycle delete
    }
  }
}
