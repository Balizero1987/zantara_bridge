# Cloud Run service for orchestrator
resource "google_cloud_run_v2_service" "orchestrator" {
  name     = "zantara-orchestrator"
  location = var.region
  
  template {
    service_account = google_service_account.orchestrator.email
    
    scaling {
      min_instance_count = var.orchestrator_min_instances
      max_instance_count = var.orchestrator_max_instances
    }
    
    containers {
      # Use a placeholder image initially - will be updated after build
      image = "gcr.io/cloudrun/hello"
      
      ports {
        container_port = 8080
      }
      
      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }
      
      env {
        name  = "REGION"
        value = var.region
      }
      
      env {
        name  = "PUBSUB_TOPIC"
        value = google_pubsub_topic.tasks.name
      }
      
      env {
        name = "API_KEY_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.api_key.secret_id
            version = "latest"
          }
        }
      }
      
      env {
        name = "OPENAI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.openai_key.secret_id
            version = "latest"
          }
        }
      }
      
      resources {
        limits = {
          cpu    = var.orchestrator_cpu
          memory = var.orchestrator_memory
        }
      }
    }
  }
  
  depends_on = [google_project_service.required_apis]
}

# Cloud Run service for lightweight agents
resource "google_cloud_run_v2_service" "light_agent" {
  name     = "zantara-light-agent"
  location = var.region
  
  template {
    service_account = google_service_account.agents.email
    
    scaling {
      min_instance_count = 0
      max_instance_count = var.agent_max_instances
    }
    
    containers {
      # Use a placeholder image initially - will be updated after build
      image = "gcr.io/cloudrun/hello"
      
      ports {
        container_port = 8080
      }
      
      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }
      
      env {
        name  = "PUBSUB_SUBSCRIPTION"
        value = google_pubsub_subscription.orchestrator_tasks.name
      }
      
      env {
        name = "API_KEY_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.api_key.secret_id
            version = "latest"
          }
        }
      }
      
      resources {
        limits = {
          cpu    = var.agent_cpu
          memory = var.agent_memory
        }
      }
    }
  }
  
  depends_on = [google_project_service.required_apis]
}

# IAM policy to allow public access to orchestrator (for demo)
resource "google_cloud_run_service_iam_member" "orchestrator_public" {
  location = google_cloud_run_v2_service.orchestrator.location
  service  = google_cloud_run_v2_service.orchestrator.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# IAM policy to allow public access to light agent (for demo)
resource "google_cloud_run_service_iam_member" "light_agent_public" {
  location = google_cloud_run_v2_service.light_agent.location
  service  = google_cloud_run_v2_service.light_agent.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}