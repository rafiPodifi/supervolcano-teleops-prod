data "google_compute_network" "default" {
  name = "default"
}

# Already created via gcloud during bootstrap. Declarative import block
# (Terraform 1.5+) so cold applies pick it up automatically without a
# manual `terraform import` step.
import {
  to = google_compute_global_address.service_networking
  id = "projects/${var.project_id}/global/addresses/google-managed-services-default"
}

# Reserved range for service networking (Cloud SQL private IP).
resource "google_compute_global_address" "service_networking" {
  name          = "google-managed-services-default"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = data.google_compute_network.default.id

  depends_on = [google_project_service.apis]
}

# Peer the default VPC with Google's service networking. Required for
# Cloud SQL private IP. Idempotent.
resource "google_service_networking_connection" "private_vpc" {
  network                 = data.google_compute_network.default.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.service_networking.name]

  deletion_policy = "ABANDON"
}

# Serverless VPC connector — Cloud Run egress into the VPC.
resource "google_vpc_access_connector" "primary" {
  name    = "vpc-conn-usw1"
  region  = var.region
  network = data.google_compute_network.default.name
  # Serverless VPC connector requires exactly /28.
  ip_cidr_range = "10.8.0.0/28"
  min_instances = 2
  max_instances = 10
  machine_type  = "e2-micro"

  depends_on = [google_project_service.apis]
}
