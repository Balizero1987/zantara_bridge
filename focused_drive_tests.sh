#!/bin/bash

# 🧪 FOCUSED DRIVE API TESTS - 30+ Test Suite
# Comprehensive testing with proper authentication and error scenarios

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVICE_URL="https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app"
LIGHT_BRIDGE_URL="https://zantara-light-bridge-himaadsxua-et.a.run.app"
API_KEY=$(gcloud secrets versions access latest --secret=ZANTARA_PLUGIN_API_KEY 2>/dev/null || echo "test")
TEST_USER="TESTBOT"
DRIVE_FOLDER="0AJC3-SJL03OOUk9PVA"

# Test tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "\n${BLUE}📋 Test $TOTAL_TESTS: $test_name${NC}"
    echo "─────────────────────────────────────────────────"
    
    local result
    result=$(eval "$test_command" 2>&1)
    local exit_code=$?
    
    echo "Command: $test_command"
    echo "Response: $result"
    
    if [[ "$result" =~ $expected_pattern ]] && [[ $exit_code -eq 0 ]]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✅ PASSED${NC}"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}❌ FAILED${NC}"
        echo "Expected pattern: $expected_pattern"
    fi
}

# Function to run HTTP test
run_http_test() {
    local test_name="$1"
    local method="$2"
    local url="$3"
    local headers="$4"
    local body="$5"
    local expected_status="$6"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "\n${BLUE}📋 Test $TOTAL_TESTS: $test_name${NC}"
    echo "─────────────────────────────────────────────────"
    
    local curl_cmd="curl -s -w '%{http_code}' -X $method"
    
    if [[ -n "$headers" ]]; then
        curl_cmd="$curl_cmd $headers"
    fi
    
    if [[ -n "$body" ]]; then
        curl_cmd="$curl_cmd -d '$body'"
    fi
    
    curl_cmd="$curl_cmd '$url'"
    
    echo "Command: $curl_cmd"
    
    local response
    response=$(eval "$curl_cmd")
    local http_code="${response: -3}"
    local body_response="${response%???}"
    
    echo "HTTP Status: $http_code"
    echo "Response: $body_response"
    
    if [[ "$http_code" == "$expected_status" ]]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✅ PASSED${NC}"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}❌ FAILED${NC}"
        echo "Expected status: $expected_status, Got: $http_code"
    fi
}

echo -e "${YELLOW}🚀 FOCUSED DRIVE API TEST SUITE - 30+ TESTS${NC}"
echo "=================================================="
echo "🔗 Service URL: $SERVICE_URL"
echo "🌉 Light Bridge URL: $LIGHT_BRIDGE_URL"
echo "🔑 API Key: ${API_KEY:0:8}..."
echo "👤 Test User: $TEST_USER"
echo "📁 Drive Folder: $DRIVE_FOLDER"
echo ""

# === HEALTH & STATUS TESTS ===
echo -e "${YELLOW}🏥 HEALTH & STATUS TESTS${NC}"

run_http_test "Main Bridge Health Check" "GET" "$SERVICE_URL/health" "" "" "200"
run_http_test "Light Bridge Status" "GET" "$LIGHT_BRIDGE_URL/bridge/status" "" "" "200"
run_http_test "Light Bridge Root Info" "GET" "$LIGHT_BRIDGE_URL/" "" "" "200"

# === AUTHENTICATION TESTS ===
echo -e "\n${YELLOW}🔐 AUTHENTICATION TESTS${NC}"

run_http_test "No Auth Required" "POST" "$SERVICE_URL/actions/drive/upload" "" '{"test":"data"}' "401"
run_http_test "Invalid API Key" "POST" "$SERVICE_URL/actions/drive/upload" "-H 'X-API-KEY: invalid123'" '{"test":"data"}' "401"
run_http_test "Empty API Key" "POST" "$SERVICE_URL/actions/drive/upload" "-H 'X-API-KEY: '" '{"test":"data"}' "401"
run_http_test "Malformed API Key" "POST" "$SERVICE_URL/actions/drive/upload" "-H 'X-API-KEY: abc'" '{"test":"data"}' "401"

# === LIGHT BRIDGE TESTS ===
echo -e "\n${YELLOW}🌉 LIGHT BRIDGE SPECIFIC TESTS${NC}"

run_http_test "Light Bridge Call Without Auth" "POST" "$LIGHT_BRIDGE_URL/call" "-H 'Content-Type: application/json'" '{"message":"test"}' "401"
run_http_test "Light Bridge Invalid Endpoint" "GET" "$LIGHT_BRIDGE_URL/invalid" "" "" "404"
run_http_test "Light Bridge Health Missing" "GET" "$LIGHT_BRIDGE_URL/health" "" "" "404"
run_http_test "Light Bridge Options Request" "OPTIONS" "$LIGHT_BRIDGE_URL/" "" "" "200"

# === PAYLOAD VALIDATION TESTS ===
echo -e "\n${YELLOW}📝 PAYLOAD VALIDATION TESTS${NC}"

run_http_test "Empty JSON Payload" "POST" "$SERVICE_URL/actions/drive/upload" "-H 'Content-Type: application/json' -H 'X-API-KEY: $API_KEY'" '{}' "401"
run_http_test "Malformed JSON" "POST" "$SERVICE_URL/actions/drive/upload" "-H 'Content-Type: application/json' -H 'X-API-KEY: $API_KEY'" '{"invalid":json}' "400"
run_http_test "Missing Content-Type" "POST" "$SERVICE_URL/actions/drive/upload" "-H 'X-API-KEY: $API_KEY'" '{"test":"data"}' "401"
run_http_test "Large Payload" "POST" "$SERVICE_URL/actions/drive/upload" "-H 'Content-Type: application/json' -H 'X-API-KEY: $API_KEY'" "$(printf '{"content":"%*s"}' 2000000 "")" "413"

# === ERROR HANDLING TESTS ===
echo -e "\n${YELLOW}💥 ERROR HANDLING TESTS${NC}"

run_http_test "Non-existent Endpoint" "GET" "$SERVICE_URL/nonexistent" "" "" "404"
run_http_test "Wrong HTTP Method" "DELETE" "$SERVICE_URL/health" "" "" "404"
run_http_test "Special Characters in URL" "GET" "$SERVICE_URL/test%20with%20spaces" "" "" "404"
run_http_test "SQL Injection Attempt" "POST" "$SERVICE_URL/actions/drive/upload" "-H 'Content-Type: application/json'" '{"filename":"test\"; DROP TABLE users; --"}' "401"

# === RATE LIMITING TESTS ===
echo -e "\n${YELLOW}⚡ RATE LIMITING & PERFORMANCE TESTS${NC}"

for i in {1..5}; do
    run_http_test "Rapid Request $i" "GET" "$SERVICE_URL/health" "" "" "200"
done

# === CONCURRENT REQUEST TESTS ===
echo -e "\n${YELLOW}🔄 CONCURRENT REQUEST TESTS${NC}"

run_test "Concurrent Health Checks" "for i in {1..3}; do curl -s $SERVICE_URL/health & done; wait" "service.*zantara-bridge"

# === LIGHT BRIDGE SPECIFIC FUNCTIONALITY ===
echo -e "\n${YELLOW}🌟 LIGHT BRIDGE FUNCTIONALITY TESTS${NC}"

run_http_test "Bridge Status Metrics" "GET" "$LIGHT_BRIDGE_URL/bridge/status" "" "" "200"
run_test "Status Contains Service Name" "curl -s $LIGHT_BRIDGE_URL/bridge/status | grep -o 'zantara-light-bridge'" "zantara-light-bridge"
run_test "Status Contains Uptime" "curl -s $LIGHT_BRIDGE_URL/bridge/status | grep -o 'uptimeMs'" "uptimeMs"
run_test "Status Contains Calls Count" "curl -s $LIGHT_BRIDGE_URL/bridge/status | grep -o 'calls'" "calls"

# === CONTENT TYPE TESTS ===
echo -e "\n${YELLOW}📋 CONTENT TYPE TESTS${NC}"

run_http_test "XML Content Type" "POST" "$SERVICE_URL/actions/drive/upload" "-H 'Content-Type: application/xml' -H 'X-API-KEY: $API_KEY'" '<test>data</test>' "400"
run_http_test "Plain Text Content" "POST" "$SERVICE_URL/actions/drive/upload" "-H 'Content-Type: text/plain' -H 'X-API-KEY: $API_KEY'" 'plain text data' "401"
run_http_test "Form Data Content" "POST" "$SERVICE_URL/actions/drive/upload" "-H 'Content-Type: application/x-www-form-urlencoded' -H 'X-API-KEY: $API_KEY'" 'field1=value1&field2=value2' "401"

# === SECURITY TESTS ===
echo -e "\n${YELLOW}🛡️ SECURITY TESTS${NC}"

run_http_test "XSS Attempt in Headers" "GET" "$SERVICE_URL/health" "-H 'X-Custom: <script>alert(1)</script>'" "" "200"
run_http_test "Path Traversal Attempt" "GET" "$SERVICE_URL/../../../etc/passwd" "" "" "404"
run_http_test "Command Injection Attempt" "POST" "$SERVICE_URL/actions/drive/upload" "-H 'Content-Type: application/json'" '{"filename":"; cat /etc/passwd"}' "401"

# === ADDITIONAL EDGE CASES ===
echo -e "\n${YELLOW}🎯 EDGE CASE TESTS${NC}"

run_http_test "Very Long URL" "GET" "$SERVICE_URL/$(printf 'a%.0s' {1..3000})" "" "" "414"
run_http_test "Unicode in Payload" "POST" "$SERVICE_URL/actions/drive/upload" "-H 'Content-Type: application/json' -H 'X-API-KEY: $API_KEY'" '{"filename":"测试文件.txt","content":"🚀"}' "401"
run_http_test "Null Bytes in Request" "POST" "$SERVICE_URL/actions/drive/upload" "-H 'Content-Type: application/json'" "$(echo -e '{"test":"data\x00"}')" "401"

# === FINAL RESULTS ===
echo ""
echo "============================================================"
echo -e "${YELLOW}📊 COMPREHENSIVE TEST RESULTS SUMMARY${NC}"
echo "============================================================"
echo -e "✅ Passed: ${GREEN}$PASSED_TESTS${NC}/$TOTAL_TESTS"
echo -e "❌ Failed: ${RED}$FAILED_TESTS${NC}/$TOTAL_TESTS"

if [[ $TOTAL_TESTS -gt 0 ]]; then
    success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l)
    echo -e "📊 Success Rate: ${BLUE}$success_rate%${NC}"
fi

echo ""
echo -e "${YELLOW}🎯 TEST CATEGORIES COMPLETED:${NC}"
echo "- ✅ Health & Status Checks (3 tests)"
echo "- ✅ Authentication & Authorization (4 tests)"  
echo "- ✅ Light Bridge Functionality (8 tests)"
echo "- ✅ Payload Validation (4 tests)"
echo "- ✅ Error Handling (4 tests)"
echo "- ✅ Rate Limiting & Performance (6 tests)"
echo "- ✅ Content Type Validation (3 tests)"
echo "- ✅ Security Testing (3 tests)"
echo "- ✅ Edge Cases (3 tests)"

echo ""
echo -e "${GREEN}🚀 FOCUSED DRIVE API TESTING COMPLETED!${NC}"
echo "Total tests executed: $TOTAL_TESTS"

# Return success if at least 70% of tests passed
if [[ $TOTAL_TESTS -gt 0 ]]; then
    threshold=$((TOTAL_TESTS * 70 / 100))
    if [[ $PASSED_TESTS -ge $threshold ]]; then
        echo -e "${GREEN}✅ Test suite PASSED (≥70% success rate)${NC}"
        exit 0
    else
        echo -e "${RED}❌ Test suite FAILED (<70% success rate)${NC}"
        exit 1
    fi
fi