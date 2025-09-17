variable "project_id" {
  description = "The GCP project ID where resources will be created"
  type        = string
}

variable "region" {
  description = "The GCP region where resources will be deployed"
  type        = string
  default     = "asia-southeast2"
}

variable "firestore_location" {
  description = "The location for the Firestore database"
  type        = string
  default     = "asia-southeast2"
}

# Orchestrator configuration
variable "orchestrator_min_instances" {
  description = "Minimum number of orchestrator instances"
  type        = number
  default     = 1
}

variable "orchestrator_max_instances" {
  description = "Maximum number of orchestrator instances"
  type        = number
  default     = 3
}

variable "orchestrator_cpu" {
  description = "CPU allocation for orchestrator service"
  type        = string
  default     = "2"
}

variable "orchestrator_memory" {
  description = "Memory allocation for orchestrator service"
  type        = string
  default     = "4Gi"
}

# Agent configuration
variable "agent_max_instances" {
  description = "Maximum number of agent instances"
  type        = number
  default     = 10
}

variable "agent_cpu" {
  description = "CPU allocation for agent services"
  type        = string
  default     = "1"
}

variable "agent_memory" {
  description = "Memory allocation for agent services"
  type        = string
  default     = "2Gi"
}

# Storage configuration
variable "storage_force_destroy" {
  description = "Allow destruction of storage bucket even if it contains objects"
  type        = bool
  default     = false
}

variable "storage_lifecycle_days" {
  description = "Number of days after which objects are automatically deleted"
  type        = number
  default     = 90
}

# Budget and monitoring
variable "enable_budget_alerts" {
  description = "Enable budget alerts for cost monitoring"
  type        = bool
  default     = true
}

variable "billing_account_id" {
  description = "The billing account ID for budget alerts"
  type        = string
  default     = ""
}

variable "monthly_budget_limit" {
  description = "Monthly budget limit in USD"
  type        = number
  default     = 500
}

variable "notification_channels" {
  description = "List of notification channel IDs for alerts"
  type        = list(string)
  default     = []
}

# Environment configuration
variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}