# Copy this file to terraform.tfvars and fill in your values

# Required variables
project_id = "involuted-box-469105-r0"
region     = "asia-southeast2"

# Optional: Override defaults
environment = "dev"

# Orchestrator configuration
orchestrator_min_instances = 1
orchestrator_max_instances = 3
orchestrator_cpu          = "2"
orchestrator_memory       = "4Gi"

# Agent configuration
agent_max_instances = 10
agent_cpu          = "1"
agent_memory       = "2Gi"

# Budget configuration (optional)
enable_budget_alerts = false
billing_account_id   = "your-billing-account-id"
monthly_budget_limit = 500

# Notification channels (optional - add after creating notification channels)
# notification_channels = ["projects/your-project/notificationChannels/123456"]