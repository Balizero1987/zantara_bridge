# Zantara Light Bridge - Production Configuration Guide

## Zero-Cost Production Setup

This guide helps you configure Zantara Light Bridge for production deployment with zero-cost operation on Google Cloud Run.

## Required Environment Variables

### Authentication (CRITICAL)
```bash
# Strong API keys - use 32+ character random strings
ZANTARA_PLUGIN_API_KEY=your-secure-32-char-api-key
API_KEYS=your-secure-32-char-api-key

# Optional AI service keys (if using AI features)
CLAUDE_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-...
```

### Google Cloud Configuration
```bash
# Your GCP project
GOOGLE_CLOUD_PROJECT=your-project-id

# Service Account (recommended)
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# OR use impersonation (more secure)
IMPERSONATE_USER=your-email@domain.com
```

### Drive Folders
```bash
# Your shared Google Drive folder ID
DRIVE_FOLDER_ID=1ABC123DEF456GHI789JKL
MEMORY_DRIVE_FOLDER_ID=1ABC123DEF456GHI789JKL
DRIVE_FOLDER_AMBARADAM=1ABC123DEF456GHI789JKL

# Email mapping
DRIVE_OWNER_MAP={"BOSS":"your-email@domain.com","DEFAULT":"your-email@domain.com"}
```

## Zero-Cost Deployment Steps

### 1. Create Google Cloud Run Service
```bash
PROJECT_ID=your-project-id
REGION=asia-southeast2
SERVICE=zantara-light-bridge

# Deploy with zero-cost settings
gcloud run deploy $SERVICE \
  --region $REGION \
  --image gcr.io/$PROJECT_ID/zantara-light-bridge:latest \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production,PORT=8080" \
  --set-secrets "ZANTARA_PLUGIN_API_KEY=ZANTARA_API_KEY:latest" \
  --set-secrets "GOOGLE_SERVICE_ACCOUNT_KEY=GOOGLE_SA_KEY:latest"
```

### 2. Configure Secrets in Secret Manager
```bash
# Create secrets
echo "your-32-char-api-key" | gcloud secrets create ZANTARA_API_KEY --data-file=-
echo '{"type":"service_account",...}' | gcloud secrets create GOOGLE_SA_KEY --data-file=-

# Grant Cloud Run access
gcloud secrets add-iam-policy-binding ZANTARA_API_KEY \
  --member="serviceAccount:your-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. Zero-Cost Optimization Features

- **CPU scaling to zero**: No charges when not in use
- **Minimal memory**: 512Mi for basic operations
- **Request-based billing**: Only pay for actual usage
- **Efficient caching**: Reduced redundant operations
- **Lightweight auth**: Fast authentication without enterprise overhead

## Security Best Practices

1. **Never use test credentials in production**
2. **Use Secret Manager for all sensitive data**
3. **Implement proper API key rotation**
4. **Enable audit logging for compliance**
5. **Use service account impersonation when possible**

## Monitoring

The light bridge includes basic monitoring:
- `/health` - Health check endpoint
- `/bridge/status` - Service metrics
- Cloud Run logs for troubleshooting

## Cost Optimization

- Scales to zero when not in use
- Minimal resource allocation
- Efficient request processing
- No persistent storage costs
- Free tier friendly configuration