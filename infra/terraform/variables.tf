variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "Primary region"
  type        = string
  default     = "us-west1"
}

variable "github_repo" {
  description = "GitHub repo (owner/name) for Workload Identity Federation"
  type        = string
  default     = "rafiPodifi/supervolcano-teleops-prod"
}

variable "envs" {
  description = "Environments to provision"
  type        = list(string)
  default     = ["staging", "prod"]
}

variable "envs_set" {
  description = "Same as envs but as a set, used for for_each"
  type        = set(string)
  default     = ["staging", "prod"]
}
