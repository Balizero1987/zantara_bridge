#!/bin/bash
set -euo pipefail

echo "🔥 Deploying Firestore composite indexes..."

# Check if gcloud is available
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed or not in PATH"
    exit 1
fi

# Get current project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [[ -z "$PROJECT_ID" ]]; then
    echo "❌ No active gcloud project. Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "📁 Project: $PROJECT_ID"

# Deploy using firestore.indexes.json if it exists
if [[ -f "firestore.indexes.json" ]]; then
    echo "📝 Deploying indexes from firestore.indexes.json..."
    gcloud firestore indexes composite create --file=firestore.indexes.json --project="$PROJECT_ID"
else
    echo "📝 Creating indexes manually..."
    
    # fileIndex collection indexes
    echo "Creating fileIndex composite indexes..."
    
    # Index 1: (canonicalOwner ASC, kind ASC, ts DESC)
    gcloud firestore indexes composite create \
        --collection-group=fileIndex \
        --field-config field-path=canonicalOwner,order=ASCENDING \
        --field-config field-path=kind,order=ASCENDING \
        --field-config field-path=ts,order=DESCENDING \
        --project="$PROJECT_ID" || true
    
    # Index 2: (canonicalOwner ASC, kind ASC, dateKey DESC, ts DESC)  
    gcloud firestore indexes composite create \
        --collection-group=fileIndex \
        --field-config field-path=canonicalOwner,order=ASCENDING \
        --field-config field-path=kind,order=ASCENDING \
        --field-config field-path=dateKey,order=DESCENDING \
        --field-config field-path=ts,order=DESCENDING \
        --project="$PROJECT_ID" || true
    
    # notes collection index (if not exists)
    echo "Creating notes composite index..."
    gcloud firestore indexes composite create \
        --collection-group=notes \
        --field-config field-path=canonicalOwner,order=ASCENDING \
        --field-config field-path=dateKey,order=ASCENDING \
        --field-config field-path=ts,order=ASCENDING \
        --project="$PROJECT_ID" || true
fi

echo "✅ Firestore indexes deployment completed"
echo "ℹ️  Indexes may take several minutes to build in production"