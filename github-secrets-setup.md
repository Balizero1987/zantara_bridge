# GitHub Secrets Setup for GitHub Actions Deployment

## Required Secrets

You need to configure these secrets in your GitHub repository:

### 1. GOOGLE_SERVICE_ACCOUNT_KEY
This is your Google Cloud service account JSON key.

```bash
# Get your current service account key
cat service-account.json | base64

# Or create a new one
gcloud iam service-accounts keys create github-deploy-key.json \
  --iam-account=github-deploy@involuted-box-469105-r0.iam.gserviceaccount.com
```

### 2. Set up secrets via GitHub CLI

```bash
# Set the service account key
gh secret set GOOGLE_SERVICE_ACCOUNT_KEY < service-account.json

# Set other required secrets
gh secret set MEMORY_DRIVE_FOLDER_ID --body "1UGbm5er6Go351S57GQKUjmxMxHyT4QZb"
gh secret set AMBARADAM_DRIVE_ID --body "0AJC3-SJL03OOUk9PVA"
gh secret set ZANTARA_PLUGIN_API_KEY --body "your-api-key-here"
gh secret set API_KEYS --body "your-api-keys-here"
```

### 3. Create the service account if it doesn't exist

```bash
# Create service account for GitHub Actions
gcloud iam service-accounts create github-deploy \
  --display-name="GitHub Actions Deploy"

# Grant necessary permissions
gcloud projects add-iam-policy-binding involuted-box-469105-r0 \
  --member="serviceAccount:github-deploy@involuted-box-469105-r0.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding involuted-box-469105-r0 \
  --member="serviceAccount:github-deploy@involuted-box-469105-r0.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding involuted-box-469105-r0 \
  --member="serviceAccount:github-deploy@involuted-box-469105-r0.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.admin"
```

### 4. Manual Setup via GitHub UI

Alternatively, go to your repository settings:
1. Navigate to Settings > Secrets and variables > Actions
2. Click "New repository secret"
3. Add each secret with the values above

## Advantages of GitHub Actions over Cloud Build

1. **Cost**: GitHub Actions provides generous free minutes for public repos
2. **Integration**: Better integration with GitHub features (PRs, issues, etc.)
3. **Flexibility**: More pre-built actions and easier customization
4. **Visibility**: Better logs and monitoring in GitHub UI
5. **Security**: Workload Identity Federation for secure GCP access

## Testing the Deployment

Once secrets are configured, you can:

1. Push to main branch to trigger automatic deployment
2. Use `workflow_dispatch` to manually trigger deployment
3. Monitor deployment in the Actions tab

The workflow includes:
- Automated testing and linting
- Docker build and push to Artifact Registry
- Cloud Run deployment
- Health checks
- Post-deployment smoke tests