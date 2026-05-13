# Identity Platform tenants — staging + prod user pools in one project.
# Requires Identity Platform initialized on the project (one-time, may need
# manual console click at console.cloud.google.com/customer-identity).
resource "google_identity_platform_tenant" "tenants" {
  for_each = var.envs_set

  display_name             = each.key
  allow_password_signup    = true
  enable_email_link_signin = false

  depends_on = [google_project_service.apis]
}
