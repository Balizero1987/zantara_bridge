# Project outputs
output "project_id" {
  description = "The GCP project ID"
  value       = var.project_id
}

output "region" {
  description = "The deployment region"
  value       = var.region
}

# Pub/Sub outputs
output "pubsub_topic_name" {
  description = "Name of the Pub/Sub topic for task distribution"
  value       = google_pubsub_topic.tasks.name
}

output "pubsub_subscription_name" {
  description = "Name of the Pub/Sub subscription for orchestrator"
  value       = google_pubsub_subscription.orchestrator_tasks.name
}

# Secret Manager outputs
output "api_key_secret_id" {
  description = "ID of the API key secret in Secret Manager"
  value       = google_secret_manager_secret.api_key.secret_id
}

output "openai_key_secret_id" {
  description = "ID of the OpenAI key secret in Secret Manager"
  value       = google_secret_manager_secret.openai_key.secret_id
}

output "github_token_secret_id" {
  description = "ID of the GitHub token secret in Secret Manager"
  value       = google_secret_manager_secret.github_token.secret_id
}

# Artifact Registry outputs
output "artifact_registry_repository" {
  description = "Name of the Artifact Registry repository"
  value       = google_artifact_registry_repository.zantara_repo.repository_id
}

output "container_registry_url" {
  description = "URL for pushing container images"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.zantara_repo.repository_id}"
}

# Service Account outputs
output "orchestrator_service_account_email" {
  description = "Email of the orchestrator service account"
  value       = google_service_account.orchestrator.email
}

output "agents_service_account_email" {
  description = "Email of the agents service account"
  value       = google_service_account.agents.email
}

# Storage outputs
output "storage_bucket_name" {
  description = "Name of the Cloud Storage bucket"
  value       = google_storage_bucket.zantara_storage.name
}

output "storage_bucket_url" {
  description = "URL of the Cloud Storage bucket"
  value       = google_storage_bucket.zantara_storage.url
}

# Cloud Run outputs
output "orchestrator_service_url" {
  description = "URL of the orchestrator Cloud Run service"
  value       = google_cloud_run_v2_service.orchestrator.uri
}

output "light_agent_service_url" {
  description = "URL of the light agent Cloud Run service"
  value       = google_cloud_run_v2_service.light_agent.uri
}

# Useful commands for setting up secrets
output "setup_commands" {
  description = "Commands to set up secrets after deployment"
  value = {
    api_key = "echo 'your-api-key' | gcloud secrets versions add ${google_secret_manager_secret.api_key.secret_id} --data-file=-"
    openai_key = "echo 'your-openai-key' | gcloud secrets versions add ${google_secret_manager_secret.openai_key.secret_id} --data-file=-"
    github_token = "echo 'your-github-token' | gcloud secrets versions add ${google_secret_manager_secret.github_token.secret_id} --data-file=-"
  }
}