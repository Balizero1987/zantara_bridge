# Zantara Multi-Agent Infrastructure

This Terraform configuration sets up the complete infrastructure for the Zantara multi-agent system on Google Cloud Platform.

## Architecture

- **Orchestrator**: Cloud Run service that coordinates tasks
- **Light Agents**: Cloud Run services for lightweight operations
- **Heavy Agents**: Can be deployed separately (local/on-prem)
- **Pub/Sub**: Message queue for task distribution
- **Firestore**: Document database for structured data
- **Secret Manager**: Secure storage for API keys
- **Cloud Storage**: Large file and report storage

## Prerequisites

1. Google Cloud SDK installed and authenticated
2. Terraform >= 1.0 installed
3. A GCP project with billing enabled

## Setup

1. **Copy the example variables file:**
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

2. **Edit terraform.tfvars with your values:**
   - Set your `project_id`
   - Configure region (default: asia-southeast2)
   - Adjust resource limits as needed

3. **Initialize Terraform:**
   ```bash
   terraform init
   ```

4. **Plan the deployment:**
   ```bash
   terraform plan
   ```

5. **Apply the configuration:**
   ```bash
   terraform apply
   ```

## Post-Deployment Setup

### Add Secrets
After deployment, add your API keys to Secret Manager:

```bash
# Add your API key
echo "your-api-key" | gcloud secrets versions add zantara-api-key --data-file=-

# Add OpenAI API key
echo "your-openai-key" | gcloud secrets versions add zantara-openai-key --data-file=-

# Add GitHub token
echo "your-github-token" | gcloud secrets versions add zantara-github-token --data-file=-
```

### Build and Deploy Container Images

1. **Configure Docker for Artifact Registry:**
   ```bash
   gcloud auth configure-docker asia-southeast2-docker.pkg.dev
   ```

2. **Build and push your images:**
   ```bash
   # For orchestrator
   docker build -t asia-southeast2-docker.pkg.dev/YOUR_PROJECT/zantara-repo/zantara-orchestrator:latest ./orchestrator
   docker push asia-southeast2-docker.pkg.dev/YOUR_PROJECT/zantara-repo/zantara-orchestrator:latest

   # For light agent
   docker build -t asia-southeast2-docker.pkg.dev/YOUR_PROJECT/zantara-repo/zantara-light-agent:latest ./light-agent
   docker push asia-southeast2-docker.pkg.dev/YOUR_PROJECT/zantara-repo/zantara-light-agent:latest
   ```

## Key Resources Created

- **Cloud Run Services**: Orchestrator and light agent services
- **Pub/Sub**: Topic and subscription for task messaging
- **Firestore**: Native database for structured data
- **Secret Manager**: Secure storage for credentials
- **Cloud Storage**: Bucket for large files
- **IAM**: Service accounts with minimal required permissions
- **Monitoring**: Error rate alerts and budget notifications

## Security Features

- Service accounts with least privilege access
- Secrets stored in Secret Manager (not in code)
- Container images in private Artifact Registry
- Firestore security rules (to be configured)
- Budget alerts to prevent cost overruns

## Monitoring

The setup includes:
- Error rate monitoring for Cloud Run services
- Budget alerts at 80% and 100% of monthly limit
- Cloud Logging for all services

## Scaling

- **Orchestrator**: Scales 1-3 instances by default
- **Light Agents**: Scales 0-10 instances by default
- **Heavy Agents**: Deploy separately as needed

## Cost Optimization

- Auto-scaling to zero for agents when not in use
- Object lifecycle management (90-day retention)
- Budget alerts to monitor spending
- Configurable resource limits

## Cleanup

To destroy all resources:
```bash
terraform destroy
```

**Warning**: This will delete all data. Make sure to backup important data first.