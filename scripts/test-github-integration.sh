#!/bin/bash

# Test script for GitHub integration
# Usage: ./scripts/test-github-integration.sh [BASE_URL] [API_KEY]

set -e

BASE_URL=${1:-"http://localhost:8080"}
API_KEY=${2:-$ZANTARA_API_KEY}
TODAY=$(date -u +"%Y-%m-%d")

if [ -z "$API_KEY" ]; then
    echo "❌ API_KEY required. Set ZANTARA_API_KEY env var or pass as second argument"
    exit 1
fi

echo "🧪 Testing GitHub Integration for Zantara Bridge"
echo "   Base URL: $BASE_URL"
echo "   Date: $TODAY"
echo ""

# Test 1: GitHub connection test
echo "1️⃣ Testing GitHub connection..."
GITHUB_TEST=$(curl -s -H "X-API-KEY: $API_KEY" -H "X-BZ-USER: boss" \
    "$BASE_URL/api/github/_test" | jq -r '.ok // false')

if [ "$GITHUB_TEST" = "true" ]; then
    echo "   ✅ GitHub connection successful"
else
    echo "   ❌ GitHub connection failed - check GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO"
    echo "   ℹ️  Continuing tests anyway..."
fi

# Test 2: Create test note with GitHub references
echo ""
echo "2️⃣ Creating test note with GitHub references..."
NOTE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/notes" \
    -H "Content-Type: application/json" \
    -H "X-API-KEY: $API_KEY" \
    -H "X-BZ-USER: boss" \
    -d '{
        "title": "GitHub Integration Test",
        "content": "Testing GitHub integration with issue #123 and commit https://github.com/owner/repo/commit/abc123456. Also working on PR https://github.com/owner/repo/pull/456"
    }')

NOTE_ID=$(echo "$NOTE_RESPONSE" | jq -r '.id // "null"')
if [ "$NOTE_ID" != "null" ]; then
    echo "   ✅ Test note created with ID: $NOTE_ID"
else
    echo "   ❌ Failed to create test note"
    exit 1
fi

# Test 3: Analyze GitHub references
echo ""
echo "3️⃣ Analyzing GitHub references..."
ANALYZE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/github/analyze" \
    -H "Content-Type: application/json" \
    -H "X-API-KEY: $API_KEY" \
    -H "X-BZ-USER: boss" \
    -d "{\"dateKey\":\"$TODAY\"}")

REFS_COUNT=$(echo "$ANALYZE_RESPONSE" | jq -r '.totalReferences // 0')
if [ "$REFS_COUNT" -gt 0 ]; then
    echo "   ✅ Found $REFS_COUNT GitHub references"
    echo "   📊 References details:"
    echo "$ANALYZE_RESPONSE" | jq -r '.references[]? | "      - \(.type): \(.url)"'
else
    echo "   ⚠️  No GitHub references found"
fi

# Test 4: Generate GitHub brief (if GitHub is configured)
if [ "$GITHUB_TEST" = "true" ]; then
    echo ""
    echo "4️⃣ Posting brief to GitHub..."
    BRIEF_RESPONSE=$(curl -s -X POST "$BASE_URL/api/github/brief" \
        -H "Content-Type: application/json" \
        -H "X-API-KEY: $API_KEY" \
        -H "X-BZ-USER: boss" \
        -d "{\"dateKey\":\"$TODAY\"}")
    
    ISSUE_URL=$(echo "$BRIEF_RESPONSE" | jq -r '.github.issueCreated.url // "null"')
    if [ "$ISSUE_URL" != "null" ]; then
        echo "   ✅ Brief posted to GitHub: $ISSUE_URL"
    else
        echo "   ❌ Failed to post brief to GitHub"
        echo "   Response: $BRIEF_RESPONSE"
    fi
else
    echo ""
    echo "4️⃣ Skipping GitHub brief posting (GitHub not configured)"
fi

# Test 5: Test webhook endpoints
echo ""
echo "5️⃣ Testing webhook endpoints..."

# Test Claude Code webhook
WEBHOOK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/webhooks/claude-code" \
    -H "Content-Type: application/json" \
    -H "X-API-KEY: $API_KEY" \
    -d '{
        "action": "process_issue",
        "issueNumber": 123,
        "result": "Successfully processed test issue"
    }')

WEBHOOK_OK=$(echo "$WEBHOOK_RESPONSE" | jq -r '.ok // false')
if [ "$WEBHOOK_OK" = "true" ]; then
    echo "   ✅ Claude Code webhook working"
else
    echo "   ❌ Claude Code webhook failed"
fi

# Test 6: Regular Drive Brief (should still work)
echo ""
echo "6️⃣ Testing regular Drive Brief (compatibility)..."
DRIVE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/drive/brief" \
    -H "Content-Type: application/json" \
    -H "X-API-KEY: $API_KEY" \
    -H "X-BZ-USER: boss" \
    -d "{\"dateKey\":\"$TODAY\"}")

DRIVE_OK=$(echo "$DRIVE_RESPONSE" | jq -r '.ok // false')
if [ "$DRIVE_OK" = "true" ]; then
    echo "   ✅ Drive Brief still working (backward compatibility)"
    FILE_NAME=$(echo "$DRIVE_RESPONSE" | jq -r '.file.name // "unknown"')
    echo "   📄 File: $FILE_NAME"
else
    echo "   ❌ Drive Brief failed"
fi

# Cleanup: Delete test note
echo ""
echo "🧹 Cleaning up test note..."
curl -s -X DELETE "$BASE_URL/api/notes/$NOTE_ID" \
    -H "X-API-KEY: $API_KEY" \
    -H "X-BZ-USER: boss" > /dev/null

echo ""
echo "✅ GitHub Integration tests completed!"
echo ""
echo "📋 Summary:"
echo "   GitHub Connection: $([ "$GITHUB_TEST" = "true" ] && echo "✅" || echo "❌")"
echo "   Reference Parsing: $([ "$REFS_COUNT" -gt 0 ] && echo "✅" || echo "⚠️")"
echo "   Webhook System: $([ "$WEBHOOK_OK" = "true" ] && echo "✅" || echo "❌")"
echo "   Drive Compatibility: $([ "$DRIVE_OK" = "true" ] && echo "✅" || echo "❌")"
echo ""

if [ "$GITHUB_TEST" = "true" ] && [ "$REFS_COUNT" -gt 0 ] && [ "$WEBHOOK_OK" = "true" ] && [ "$DRIVE_OK" = "true" ]; then
    echo "🎉 All tests passed! GitHub integration is ready."
    exit 0
else
    echo "⚠️  Some tests failed. Check configuration and try again."
    exit 1
fi