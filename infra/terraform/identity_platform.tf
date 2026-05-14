# Identity Platform tenants — staging + prod user pools in one project.
# Requires Identity Platform initialized on the project (one-time, may need
# manual console click at console.cloud.google.com/customer-identity).
#
# Multi-tenancy must be enabled on the project's Identity Platform config
# before tenants can be created. The config object is created by Google
# when Identity Platform is enabled on the project; TF imports it.
import {
  to = google_identity_platform_config.default
  id = "gen-lang-client-0659584673"
}

resource "google_identity_platform_config" "default" {
  project = var.project_id

  autodelete_anonymous_users = false

  sign_in {
    allow_duplicate_emails = false
    anonymous {
      enabled = false
    }
    email {
      enabled           = true
      password_required = true
    }
  }

  multi_tenant {
    allow_tenants = true
  }

  depends_on = [google_project_service.apis]
}

resource "google_identity_platform_tenant" "tenants" {
  for_each = var.envs_set

  display_name             = each.key
  allow_password_signup    = true
  enable_email_link_signin = false

  depends_on = [google_identity_platform_config.default]
}
