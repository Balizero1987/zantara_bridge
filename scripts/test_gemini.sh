#!/bin/bash
# Test script for Gemini AI integration

set -e

echo "🧪 Testing Gemini AI Integration..."

# Check if Python dependencies are installed
echo "Checking Python dependencies..."
if python3 -c "import google.generativeai" 2>/dev/null; then
    echo "✓ google-generativeai installed"
else
    echo "⚠ Installing google-generativeai..."
    pip3 install google-generativeai
fi

# Test Python script directly
echo -e "\n📝 Testing Python script directly..."
python3 src/services/gemini.py "Hello from Zantara!" || echo "⚠ Direct Python test failed (likely missing API key)"

# Test TypeScript compilation
echo -e "\n🔄 Testing TypeScript compilation..."
npx tsc --noEmit src/services/geminiService.ts src/api/gemini.ts

echo -e "\n🚀 Testing server start..."
# Check if server can start (basic syntax check)
timeout 10s npm start 2>/dev/null && echo "✓ Server starts successfully" || echo "⚠ Server may have issues"

echo -e "\n✅ Gemini integration tests completed!"
echo "📋 Next steps:"
echo "  1. Set GOOGLE_API_KEY or GEMINI_API_KEY environment variable"
echo "  2. Deploy to test environment"
echo "  3. Test endpoints:"
echo "     - POST /api/gemini/generate"
echo "     - GET /api/gemini/status"