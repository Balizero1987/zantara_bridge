#!/bin/bash
# ZANTARA Health Check + Dashboard Generator (ALL ENDPOINTS)

API_URL="https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app"
API_KEY="7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3"
USER="antonello"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
START_TIME=$(date +%s)

echo "🚀 Running ZANTARA Full Health Check at $TIMESTAMP"

# Function per test con timing
test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local data=$4
    
    local start=$(date +%s.%N)
    local status
    
    if [ "$method" = "POST" ]; then
        status=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST "$url" \
            -H "X-API-KEY: $API_KEY" -H "X-BZ-USER: $USER" \
            -H "Content-Type: application/json" \
            -d "$data" --max-time 10)
    else
        status=$(curl -s -o /dev/null -w "%{http_code}" \
            -X GET "$url" \
            -H "X-API-KEY: $API_KEY" -H "X-BZ-USER: $USER" \
            --max-time 10)
    fi
    
    local end=$(date +%s.%N)
    local duration=$(echo "$end - $start" | bc 2>/dev/null || echo "0.0")
    
    echo "$name:$status:${duration}s"
}

# === Test tutti gli endpoint ===
echo "Testing Assistant API..."
create_thread=$(test_endpoint "create_thread" "POST" "$API_URL/api/assistant/thread/create" '{"userId":"'$USER'","category":"VISA","title":"KITAS test"}')
send_message=$(test_endpoint "send_message" "POST" "$API_URL/api/chat" '{"message":"Health check"}')
search_knowledge=$(test_endpoint "search_knowledge" "POST" "$API_URL/api/assistant/search" '{"query":"KITAS"}')

echo "Testing Compliance API..."
gmail_monitor=$(test_endpoint "gmail_monitor" "POST" "$API_URL/api/compliance/gmail/monitor" '{"userEmail":"test@example.com"}')
create_deadline=$(test_endpoint "create_deadline" "POST" "$API_URL/api/compliance/deadline/create" '{"userId":"'$USER'","type":"kitas_renewal","title":"Test Deadline","description":"Test","deadline":"2025-12-15","category":"immigration","priority":"high"}')
create_dashboard=$(test_endpoint "create_dashboard" "POST" "$API_URL/api/compliance/dashboard/create" '{}')
upcoming_deadlines=$(test_endpoint "upcoming_deadlines" "GET" "$API_URL/api/compliance/upcoming-deadlines/$USER" "")

echo "Testing System Health..."
cache_stats=$(test_endpoint "cache_stats" "GET" "$API_URL/api/compliance/cache/stats" "")
process_overdue=$(test_endpoint "process_overdue" "POST" "$API_URL/api/compliance/admin/process-overdue" '{}')

# Parse risultati
parse_result() {
    local result=$1
    local name=$(echo $result | cut -d: -f1)
    local status=$(echo $result | cut -d: -f2)
    local time=$(echo $result | cut -d: -f3)
    
    if [ "$status" = "200" ]; then
        echo "<p>✅ $name: <strong>PASS</strong> ($status) - $time</p>"
    elif [ "$status" = "000" ]; then
        echo "<p>⏱️ $name: <strong>TIMEOUT</strong> ($status) - $time</p>"
    else
        echo "<p>❌ $name: <strong>FAIL</strong> ($status) - $time</p>"
    fi
}

# Calcola summary
TOTAL_TIME=$(($(date +%s) - START_TIME))
PASS_COUNT=$(echo -e "$create_thread\n$send_message\n$search_knowledge\n$gmail_monitor\n$create_deadline\n$create_dashboard\n$upcoming_deadlines\n$cache_stats\n$process_overdue" | grep -c ":200:")
TOTAL_COUNT=9
SUCCESS_RATE=$((PASS_COUNT * 100 / TOTAL_COUNT))

# === Generate Enhanced Dashboard ===
cat > ~/zantara_dashboard.html << EOF
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ZANTARA Health Dashboard</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f6f8; margin: 20px; }
    h1 { text-align: center; color: #2c3e50; }
    .summary { text-align: center; margin: 20px 0; padding: 20px; background: #e3f2fd; border-radius: 8px; }
    .section { margin: 20px 0; padding: 15px; border-radius: 8px; }
    .ok { background: #d4edda; border: 1px solid #155724; }
    .fail { background: #f8d7da; border: 1px solid #721c24; }
    .warn { background: #fff3cd; border: 1px solid #856404; }
    .progress { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; }
    .progress-bar { height: 100%; background: linear-gradient(90deg, #28a745 0%, #ffc107 70%, #dc3545 100%); }
  </style>
</head>
<body>
  <h1>📊 ZANTARA Health Dashboard</h1>
  
  <div class="summary">
    <h2>System Status: $SUCCESS_RATE% Operational</h2>
    <p><strong>Last Check:</strong> $TIMESTAMP</p>
    <p><strong>Total Time:</strong> ${TOTAL_TIME}s | <strong>Endpoints:</strong> $PASS_COUNT/$TOTAL_COUNT passed</p>
    <div class="progress">
      <div class="progress-bar" style="width: $SUCCESS_RATE%;"></div>
    </div>
  </div>

  <div class="section ok">
    <h2>🤖 Assistant API</h2>
    $(parse_result "$create_thread")
    $(parse_result "$send_message")
    $(parse_result "$search_knowledge")
  </div>

  <div class="section warn">
    <h2>📋 Compliance API</h2>
    $(parse_result "$gmail_monitor")
    $(parse_result "$create_deadline")
    $(parse_result "$create_dashboard")
    $(parse_result "$upcoming_deadlines")
  </div>

  <div class="section warn">
    <h2>⚙️ System Health</h2>
    $(parse_result "$cache_stats")
    $(parse_result "$process_overdue")
  </div>

  <div class="section">
    <h2>🔗 Quick Actions</h2>
    <p><a href="$API_URL" target="_blank">🌐 API Backend</a></p>
    <p><a href="https://zantara-dashboard.netlify.app" target="_blank">📊 User Dashboard</a></p>
    <p><button onclick="location.reload()">🔄 Refresh Status</button></p>
  </div>

  <script>
    // Auto-refresh ogni 5 minuti
    setTimeout(() => location.reload(), 300000);
  </script>
</body>
</html>
EOF

echo "✅ Enhanced Dashboard generated at ~/zantara_dashboard.html"
echo "📊 System Status: $SUCCESS_RATE% ($PASS_COUNT/$TOTAL_COUNT endpoints passing)"
echo "⏱️ Total check time: ${TOTAL_TIME}s"

# Console summary
echo ""
echo "=== ENDPOINT RESULTS ==="
echo "Assistant API:"
echo "  - $create_thread"
echo "  - $send_message" 
echo "  - $search_knowledge"
echo ""
echo "Compliance API:"
echo "  - $gmail_monitor"
echo "  - $create_deadline"
echo "  - $create_dashboard"
echo "  - $upcoming_deadlines"
echo ""
echo "System Health:"
echo "  - $cache_stats"
echo "  - $process_overdue"
echo ""
echo "🎯 Overall System Health: $SUCCESS_RATE%"