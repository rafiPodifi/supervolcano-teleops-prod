output "project_id" {
  value = var.project_id
}

output "project_number" {
  value = local.project_number
}

output "region" {
  value = var.region
}

output "artifact_registry_repo" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.containers.repository_id}"
}

output "cloud_run_urls" {
  value = { for env, svc in google_cloud_run_v2_service.web : env => svc.uri }
}

output "cloud_sql_connection_names" {
  value = { for env, inst in google_sql_database_instance.main : env => inst.connection_name }
}

output "tenant_ids" {
  value       = { for env, t in google_identity_platform_tenant.tenants : env => t.name }
  description = "Identity Platform tenant resource names. Set NEXT_PUBLIC_AUTH_TENANT_ID to the tenant ID portion (after the last /)."
}

output "wif_provider_staging" {
  value       = google_iam_workload_identity_pool_provider.github_staging.name
  description = "GitHub Actions secret WIF_PROVIDER_STAGING (main-branch only)"
}

output "wif_provider_prod" {
  value       = google_iam_workload_identity_pool_provider.github_prod.name
  description = "GitHub Actions secret WIF_PROVIDER_PROD (tag v* only)"
}

output "deploy_service_accounts" {
  value = { for env, sa in google_service_account.deploy : env => sa.email }
}

output "runtime_service_accounts" {
  value = { for env, sa in google_service_account.cloud_run : env => sa.email }
}
