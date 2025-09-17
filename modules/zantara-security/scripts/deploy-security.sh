#!/bin/bash

# Deploy Security & Monitoring Stack for Zantara Bridge
# Run this script to set up the complete security and monitoring infrastructure

set -e  # Exit on any error

echo "🚀 Deploying Zantara Security & Monitoring Stack..."

# Check prerequisites
echo "📋 Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed. Aborting." >&2; exit 1; }
command -v gcloud >/dev/null 2>&1 || { echo "❌ Google Cloud CLI is required but not installed. Aborting." >&2; exit 1; }

# Set up environment variables
echo "🔧 Setting up environment..."
export GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-zantara-secure-$(date +%s)}"
export REDIS_PASSWORD="${REDIS_PASSWORD:-zantara-redis-$(date +%s)}"
export GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT:-involuted-box-469105-r0}"

echo "Generated Grafana password: $GRAFANA_PASSWORD"
echo "Generated Redis password: $REDIS_PASSWORD"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p monitoring/grafana/{provisioning/datasources,provisioning/dashboards,dashboards}
mkdir -p monitoring/rules

# Create Grafana datasource configuration
echo "📊 Configuring Grafana datasources..."
cat > monitoring/grafana/provisioning/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

# Create dashboard provisioning
cat > monitoring/grafana/provisioning/dashboards/dashboard.yml << EOF
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    options:
      path: /var/lib/grafana/dashboards
EOF

# Create security dashboard
echo "🔒 Creating security dashboard..."
cat > monitoring/grafana/dashboards/security-dashboard.json << 'EOF'
{
  "dashboard": {
    "id": null,
    "title": "Zantara Security Dashboard",
    "tags": ["security", "zantara"],
    "style": "dark",
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Failed Authentication Attempts",
        "type": "stat",
        "targets": [
          {
            "expr": "increase(security_events_total{event_type=\"INVALID_API_KEY\"}[1h])",
            "legendFormat": "Failed Auths"
          }
        ],
        "gridPos": {"h": 8, "w": 6, "x": 0, "y": 0}
      },
      {
        "id": 2,
        "title": "Rate Limit Violations",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(security_events_total{event_type=\"RATE_LIMIT_EXCEEDED\"}[5m])",
            "legendFormat": "Rate Limit Hits/sec"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 6, "y": 0}
      }
    ],
    "time": {"from": "now-1h", "to": "now"},
    "refresh": "30s"
  }
}
EOF

# Create security alerting rules
echo "⚠️ Configuring security alerts..."
cat > monitoring/rules/security_rules.yml << EOF
groups:
  - name: security
    rules:
      - alert: HighFailedAuthentications
        expr: increase(security_events_total{event_type="INVALID_API_KEY"}[5m]) > 10
        for: 2m
        labels:
          severity: critical
          component: security
        annotations:
          summary: "High number of failed authentication attempts"
          description: "{{ \$value }} failed authentication attempts in the last 5 minutes"

      - alert: SuspiciousActivity
        expr: increase(security_events_total{risk_level="HIGH"}[1m]) > 5
        for: 1m
        labels:
          severity: warning
          component: security
        annotations:
          summary: "Suspicious activity detected"
          description: "{{ \$value }} high-risk security events in the last minute"

      - alert: ServiceDown
        expr: up{job="zantara-bridge"} == 0
        for: 1m
        labels:
          severity: critical
          component: availability
        annotations:
          summary: "Zantara Bridge service is down"
          description: "The Zantara Bridge service has been down for more than 1 minute"
EOF

# Create performance alerting rules  
cat > monitoring/rules/performance_rules.yml << EOF
groups:
  - name: performance
    rules:
      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 2m
        labels:
          severity: warning
          component: performance
        annotations:
          summary: "High API latency detected"
          description: "95th percentile latency is {{ \$value }}s"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
          component: performance
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ \$value | humanizePercentage }}"
EOF

# Configure alertmanager
echo "🚨 Configuring alert manager..."
cat > monitoring/alertmanager.yml << EOF
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@zantara.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://host.docker.internal:3000/webhook/alerts'
        send_resolved: true

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']
EOF

# Set up Google Cloud secrets
echo "🔐 Setting up Google Cloud secrets..."
if ! gcloud secrets describe zantara-api-key --quiet 2>/dev/null; then
    echo "Creating API key secret..."
    echo "$(openssl rand -hex 32)" | gcloud secrets create zantara-api-key --data-file=-
else
    echo "API key secret already exists"
fi

if ! gcloud secrets describe grafana-password --quiet 2>/dev/null; then
    echo "Creating Grafana password secret..."
    echo "$GRAFANA_PASSWORD" | gcloud secrets create grafana-password --data-file=-
else
    echo "Grafana password secret already exists"
fi

# Deploy monitoring stack
echo "🐳 Deploying monitoring stack..."
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Verify deployment
echo "✅ Verifying deployment..."
echo "Checking Prometheus..."
if curl -s http://localhost:9090/api/v1/status/config | grep -q "prometheus"; then
    echo "✅ Prometheus is running"
else
    echo "❌ Prometheus failed to start"
fi

echo "Checking Grafana..."
if curl -s http://localhost:3001/api/health | grep -q "ok"; then
    echo "✅ Grafana is running"
else
    echo "❌ Grafana failed to start"
fi

echo "Checking Redis..."
if docker exec zantara-redis redis-cli -a "$REDIS_PASSWORD" ping | grep -q "PONG"; then
    echo "✅ Redis is running"
else
    echo "❌ Redis failed to start"
fi

# Create environment file for application
echo "📝 Creating environment file..."
cat > .env.security << EOF
# Security Configuration
GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=$REDIS_PASSWORD
GRAFANA_PASSWORD=$GRAFANA_PASSWORD

# Monitoring URLs
PROMETHEUS_URL=http://localhost:9090
GRAFANA_URL=http://localhost:3001
ALERTMANAGER_URL=http://localhost:9093

# Enable security features
ENABLE_RATE_LIMITING=true
ENABLE_AUDIT_LOGGING=true
ENABLE_METRICS=true
EOF

echo ""
echo "🎉 Security & Monitoring Stack deployed successfully!"
echo ""
echo "📊 Access your dashboards:"
echo "   Prometheus: http://localhost:9090"
echo "   Grafana:    http://localhost:3001 (admin / $GRAFANA_PASSWORD)"
echo "   Alert Mgr:  http://localhost:9093"
echo ""
echo "🔧 Next steps:"
echo "1. Update your application to use .env.security"
echo "2. Import the security middleware in your Express app"
echo "3. Add metrics endpoints to your application"
echo "4. Configure alert notifications (Slack, email, etc.)"
echo ""
echo "📁 Configuration files created:"
echo "   - .env.security (load this in your app)"
echo "   - monitoring/ directory with all configs"
echo ""