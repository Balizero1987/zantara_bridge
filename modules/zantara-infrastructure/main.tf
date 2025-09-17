provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",
    "pubsub.googleapis.com",
    "firestore.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com"
  ])
  
  project = var.project_id
  service = each.value
  
  disable_on_destroy = false
}

# Pub/Sub topic for task distribution
resource "google_pubsub_topic" "tasks" {
  name = "zantara-tasks"
  
  depends_on = [google_project_service.required_apis]
}

# Pub/Sub subscription for orchestrator
resource "google_pubsub_subscription" "orchestrator_tasks" {
  name  = "zantara-orchestrator-tasks"
  topic = google_pubsub_topic.tasks.name

  ack_deadline_seconds = 60
  
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "60s"
  }
}

# Secret Manager for API keys
resource "google_secret_manager_secret" "api_key" {
  secret_id = "zantara-api-key"
  
  replication {
    auto {}
  }
  
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret" "openai_key" {
  secret_id = "zantara-openai-key"
  
  replication {
    auto {}
  }
  
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret" "github_token" {
  secret_id = "zantara-github-token"
  
  replication {
    auto {}
  }
  
  depends_on = [google_project_service.required_apis]
}

# Artifact Registry for container images
resource "google_artifact_registry_repository" "zantara_repo" {
  location      = var.region
  repository_id = "zantara-repo"
  description   = "Zantara multi-agent system container images"
  format        = "DOCKER"
  
  depends_on = [google_project_service.required_apis]
}

# Service account for orchestrator
resource "google_service_account" "orchestrator" {
  account_id   = "zantara-orchestrator"
  display_name = "Zantara Orchestrator Service Account"
  description  = "Service account for the Zantara orchestrator service"
}

# Service account for agents
resource "google_service_account" "agents" {
  account_id   = "zantara-agents"
  display_name = "Zantara Agents Service Account"
  description  = "Service account for Zantara agent services"
}

# IAM permissions for orchestrator
resource "google_project_iam_member" "orchestrator_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.orchestrator.email}"
}

resource "google_project_iam_member" "orchestrator_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.orchestrator.email}"
}

resource "google_project_iam_member" "orchestrator_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.orchestrator.email}"
}

resource "google_project_iam_member" "orchestrator_storage" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.orchestrator.email}"
}

# IAM permissions for agents
resource "google_project_iam_member" "agents_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.agents.email}"
}

resource "google_project_iam_member" "agents_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.agents.email}"
}

resource "google_project_iam_member" "agents_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.agents.email}"
}

resource "google_project_iam_member" "agents_storage" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.agents.email}"
}

# Cloud Storage bucket for large files and reports
resource "google_storage_bucket" "zantara_storage" {
  name          = "${var.project_id}-zantara-storage"
  location      = var.region
  force_destroy = var.storage_force_destroy
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    condition {
      age = var.storage_lifecycle_days
    }
    action {
      type = "Delete"
    }
  }
}