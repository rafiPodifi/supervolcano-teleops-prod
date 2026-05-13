# Named Firestore databases — one per env.
# Note: requires Firebase enabled on the project (already confirmed).
resource "google_firestore_database" "named" {
  for_each = var.envs_set

  project     = var.project_id
  name        = "${each.key}-db"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
  # PESSIMISTIC matches Firebase SDK default; required for runTransaction().
  concurrency_mode                  = "PESSIMISTIC"
  app_engine_integration_mode       = "DISABLED"
  point_in_time_recovery_enablement = each.key == "prod" ? "POINT_IN_TIME_RECOVERY_ENABLED" : "POINT_IN_TIME_RECOVERY_DISABLED"
  delete_protection_state           = each.key == "prod" ? "DELETE_PROTECTION_ENABLED" : "DELETE_PROTECTION_DISABLED"

  depends_on = [google_project_service.apis]
}
