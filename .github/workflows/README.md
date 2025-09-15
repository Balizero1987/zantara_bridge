# GitHub Actions Workload Identity Federation (WIF)

This repo includes CI (build + optional smoke) and Deploy (WIF) workflows under `.github/workflows/`.
Follow these steps to configure Google Cloud → GitHub OIDC trust and enable deployments to Cloud Run.

## 1) Service Account and Roles
```bash
PROJECT_ID=...          # e.g., involuted-box-469105-r0
REGION=...              # e.g., asia-southeast2
DEPLOY_SA=gh-deployer   # or reuse an existing SA

# Create or reuse a Service Account
gcloud iam service-accounts create "$DEPLOY_SA" \
  --project "$PROJECT_ID" --display-name "GitHub Deployer" || true

SA_EMAIL="$DEPLOY_SA@$PROJECT_ID.iam.gserviceaccount.com"

# Grant roles required to build & deploy
# Artifact Registry push
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:$SA_EMAIL" \
  --role "roles/artifactregistry.writer"
# Cloud Run deploy
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:$SA_EMAIL" \
  --role "roles/run.admin"
# If deploying with a specific runtime SA, allow impersonation of that SA
# RUNTIME_SA="<runtime-sa>@$PROJECT_ID.iam.gserviceaccount.com"
# gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
#   --member "serviceAccount:$SA_EMAIL" --role "roles/iam.serviceAccountUser"
```

## 2) Workload Identity Pool + Provider
```bash
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
POOL_ID=github-pool
PROVIDER_ID=github-provider

# Create pool
gcloud iam workload-identity-pools create "$POOL_ID" \
  --project "$PROJECT_ID" --location=global \
  --display-name "GitHub Actions Pool" || true

# Create provider (OIDC from GitHub)
WIP="projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_ID"
gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --project "$PROJECT_ID" --location=global \
  --workload-identity-pool="$POOL_ID" \
  --display-name "GitHub OIDC Provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" || true

# Allow the GitHub repo to impersonate the SA (replace OWNER/REPO)
REPO_ATTR="principalSet://iam.googleapis.com/$WIP/attribute.repository/OWNER/REPO"
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project "$PROJECT_ID" \
  --role "roles/iam.workloadIdentityUser" \
  --member "$REPO_ATTR"
```

## 3) GitHub Secrets
Set repository secrets (Settings → Secrets and variables → Actions):
- `GCP_PROJECT_ID`, `GCP_REGION`
- `GCP_ARTIFACT_REPO` (e.g., zantara-repo)
- `CLOUD_RUN_SERVICE` (e.g., zantara-bridge-v2-prod-XXXXXXXXXXXX)
- `GCP_WIF_PROVIDER` → `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
- `GCP_WIF_SERVICE_ACCOUNT` → `<deploy-sa>@PROJECT_ID.iam.gserviceaccount.com`
- Optional smoke: `SERVICE_URL`, `PLUGIN_API_KEY`

## 4) Artifact Registry (if needed)
```bash
gcloud services enable artifactregistry.googleapis.com --project "$PROJECT_ID"
gcloud artifacts repositories create "$GCP_ARTIFACT_REPO" \
  --repository-format=docker --location="$REGION" \
  --description="Zantara containers" || true
```

Workflows:
- CI: `zantara_bridge/.github/workflows/ci.yml`
- Deploy (WIF): `zantara_bridge/.github/workflows/deploy-wif.yml`

