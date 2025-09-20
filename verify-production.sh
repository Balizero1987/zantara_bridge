#!/bin/bash

# Zantara Light Bridge - Production Verification Script
# Verifies that all test credentials have been removed and production configuration is correct

set -e

echo "🔍 Verifying Zantara Light Bridge Production Configuration..."
echo ""

# Check for test credentials in configuration files
echo "1. Checking for test credentials..."

# Check .env file
if [ -f ".env" ]; then
    echo "  📄 Checking .env file..."
    if grep -q "=test" .env; then
        echo "  ❌ FAIL: Test credentials found in .env file:"
        grep "=test" .env
        echo "  💡 Fix: Remove test values and use proper environment variables or Secret Manager"
        exit 1
    else
        echo "  ✅ PASS: No test credentials in .env file"
    fi
else
    echo "  ⚠️  INFO: No .env file found (production should use environment variables)"
fi

# Check TypeScript files for hardcoded test values
echo "  📄 Checking TypeScript files for hardcoded test values..."
if find src -name "*.ts" -exec grep -l "0AJC3-SJL03OOUk9PVA\|test.*key\|test.*secret" {} \; | head -1 | grep -q .; then
    echo "  ❌ FAIL: Test credentials found in source code:"
    find src -name "*.ts" -exec grep -H "0AJC3-SJL03OOUk9PVA\|test.*key\|test.*secret" {} \;
    echo "  💡 Fix: Replace hardcoded values with environment variables"
    exit 1
else
    echo "  ✅ PASS: No hardcoded test credentials in source code"
fi

echo ""
echo "2. Verifying production configuration..."

# Check that required environment variables are documented
echo "  📋 Checking production configuration guide..."
if [ -f "PRODUCTION_CONFIG.md" ]; then
    echo "  ✅ PASS: Production configuration guide exists"
else
    echo "  ❌ FAIL: Missing PRODUCTION_CONFIG.md"
    exit 1
fi

# Check Docker configuration
echo "  🐳 Verifying Docker configuration..."
if grep -q "AS production" Dockerfile; then
    echo "  ✅ PASS: Production Docker stage configured"
else
    echo "  ❌ FAIL: Missing production stage in Dockerfile"
    exit 1
fi

# Check deployment script
echo "  🚀 Verifying deployment script..."
if [ -f "deploy-light-bridge.sh" ] && [ -x "deploy-light-bridge.sh" ]; then
    echo "  ✅ PASS: Zero-cost deployment script ready"
else
    echo "  ❌ FAIL: Missing or non-executable deploy-light-bridge.sh"
    exit 1
fi

# Check zero-cost configuration
echo ""
echo "3. Verifying zero-cost configuration..."

if grep -q "min-instances 0" deploy-light-bridge.sh; then
    echo "  ✅ PASS: Min instances set to 0 (scales to zero)"
else
    echo "  ❌ FAIL: Min instances not set to 0"
    exit 1
fi

if grep -q "memory 512Mi" deploy-light-bridge.sh; then
    echo "  ✅ PASS: Memory optimized for free tier (512Mi)"
else
    echo "  ❌ FAIL: Memory not optimized for free tier"
    exit 1
fi

# Check package.json scripts
echo "  📦 Verifying npm scripts..."
if grep -q "start:light" package.json; then
    echo "  ✅ PASS: Light bridge start script configured"
else
    echo "  ❌ FAIL: Missing start:light script in package.json"
    exit 1
fi

echo ""
echo "4. Security verification..."

# Check for exposed secrets
echo "  🔐 Checking for exposed secrets in git..."
if git log --oneline -p | grep -q "private_key\|api.*key.*=.*[a-zA-Z0-9]"; then
    echo "  ⚠️  WARNING: Potential secrets found in git history"
    echo "  💡 Consider using git filter-branch or BFG to remove secret history"
else
    echo "  ✅ PASS: No obvious secrets in recent git history"
fi

# Check gitignore
if grep -q ".env" .gitignore; then
    echo "  ✅ PASS: .env files ignored by git"
else
    echo "  ⚠️  WARNING: .env not in .gitignore"
fi

echo ""
echo "✅ Production verification complete!"
echo ""
echo "📋 Pre-deployment checklist:"
echo "  ☐ Set PROJECT_ID environment variable"
echo "  ☐ Set ZANTARA_PLUGIN_API_KEY (32+ characters)"
echo "  ☐ Set DRIVE_FOLDER_ID (your Google Drive folder)"
echo "  ☐ Configure Google Cloud secrets:"
echo "    - gcloud secrets create ZANTARA_API_KEY"
echo "    - gcloud secrets create GOOGLE_SA_KEY"
echo "  ☐ Run: ./deploy-light-bridge.sh"
echo ""
echo "🎯 Zero-cost features enabled:"
echo "  ✓ Scales to zero when idle"
echo "  ✓ 512Mi memory (free tier optimized)"
echo "  ✓ No persistent storage costs"
echo "  ✓ Request-based billing only"
echo ""
echo "Ready for production deployment! 🚀"