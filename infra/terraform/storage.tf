locals {
  bucket_purposes = ["videos", "exports", "firebase"]

  buckets = {
    for pair in setproduct(local.bucket_purposes, tolist(var.envs_set)) :
    "${pair[0]}-${pair[1]}" => {
      purpose = pair[0]
      env     = pair[1]
      # Project-prefixed so the bucket name is globally unique.
      name = "${var.project_id}-sv-${pair[0]}-${pair[1]}"
    }
  }
}

resource "google_storage_bucket" "buckets" {
  for_each = local.buckets

  name                        = each.value.name
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = each.value.env == "staging"

  versioning {
    enabled = local.env_config[each.value.env].bucket_versioning
  }

  dynamic "lifecycle_rule" {
    for_each = local.env_config[each.value.env].bucket_retention_days > 0 ? [1] : []
    content {
      action {
        type = "Delete"
      }
      condition {
        age = local.env_config[each.value.env].bucket_retention_days
      }
    }
  }

  dynamic "cors" {
    for_each = each.value.purpose == "firebase" ? [1] : []
    content {
      origin          = ["*"]
      method          = ["GET", "HEAD"]
      response_header = ["Content-Type"]
      max_age_seconds = 3600
    }
  }

  depends_on = [google_project_service.apis]
}

# Grant Cloud Run runtime SA write access to its env's non-Firebase buckets.
# The Firebase bucket is managed by the Firebase Admin SDK, which authenticates
# via Identity Platform; the Cloud Run SA does not need bulk-write access.
resource "google_storage_bucket_iam_member" "runtime_writer" {
  for_each = { for k, v in local.buckets : k => v if v.purpose != "firebase" }

  bucket = google_storage_bucket.buckets[each.key].name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run[each.value.env].email}"
}

# Firebase bucket: read-only for Cloud Run SA (signed URL generation, etc.).
resource "google_storage_bucket_iam_member" "runtime_reader_firebase" {
  for_each = { for k, v in local.buckets : k => v if v.purpose == "firebase" }

  bucket = google_storage_bucket.buckets[each.key].name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.cloud_run[each.value.env].email}"
}
