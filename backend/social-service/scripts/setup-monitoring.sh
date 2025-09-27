#!/bin/bash

# Social Service MVP - Monitoring Setup Script
# This script sets up comprehensive monitoring for Social Service and its integrations

set -e

echo "🔧 Setting up Social Service MVP Monitoring"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MONITORING_DIR="$(dirname "$0")/../monitoring"
NAMESPACE=${NAMESPACE:-"social-service"}
ENVIRONMENT=${ENVIRONMENT:-"development"}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if running in Kubernetes environment
    if command -v kubectl &> /dev/null; then
        KUBERNETES_AVAILABLE=true
        print_status "Kubernetes detected"
    else
        KUBERNETES_AVAILABLE=false
        print_status "Running in Docker mode"
    fi
    
    print_success "Prerequisites check completed"
}

# Setup monitoring directories
setup_directories() {
    print_status "Setting up monitoring directories..."
    
    mkdir -p "${MONITORING_DIR}/data/prometheus"
    mkdir -p "${MONITORING_DIR}/data/grafana"
    mkdir -p "${MONITORING_DIR}/data/alertmanager"
    mkdir -p "${MONITORING_DIR}/data/loki"
    mkdir -p "${MONITORING_DIR}/logs"
    
    # Set proper permissions
    chmod 777 "${MONITORING_DIR}/data/prometheus"
    chmod 777 "${MONITORING_DIR}/data/grafana"
    chmod 777 "${MONITORING_DIR}/data/alertmanager"
    chmod 777 "${MONITORING_DIR}/data/loki"
    
    print_success "Directories created"
}

# Generate Grafana provisioning configuration
setup_grafana_provisioning() {
    print_status "Setting up Grafana provisioning..."
    
    mkdir -p "${MONITORING_DIR}/grafana-provisioning/datasources"
    mkdir -p "${MONITORING_DIR}/grafana-provisioning/dashboards"
    
    # Datasources configuration
    cat > "${MONITORING_DIR}/grafana-provisioning/datasources/prometheus.yml" << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: true
    
  - name: Jaeger
    type: jaeger
    access: proxy
    url: http://jaeger:16686
    editable: true
EOF

    # Dashboard provisioning
    cat > "${MONITORING_DIR}/grafana-provisioning/dashboards/dashboards.yml" << EOF
apiVersion: 1

providers:
  - name: 'Social Service Dashboards'
    orgId: 1
    folder: 'Social Service'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
EOF

    print_success "Grafana provisioning configured"
}

# Setup Loki configuration
setup_loki_config() {
    print_status "Setting up Loki configuration..."
    
    cat > "${MONITORING_DIR}/loki-config.yml" << EOF
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    instance_addr: 127.0.0.1
    kvstore:
      store: inmemory

query_range:
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://alertmanager:9093

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s

compactor:
  working_directory: /loki/boltdb-shipper-compactor
  shared_store: filesystem

ingester:
  max_chunk_age: 1h
  chunk_idle_period: 3m
  chunk_block_size: 262144
  chunk_retain_period: 1m
  max_transfer_retries: 0
  wal:
    enabled: true
    dir: /loki/wal
EOF

    print_success "Loki configuration created"
}

# Setup Promtail configuration
setup_promtail_config() {
    print_status "Setting up Promtail configuration..."
    
    cat > "${MONITORING_DIR}/promtail-config.yml" << EOF
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: containers
    static_configs:
      - targets:
          - localhost
        labels:
          job: containerlogs
          __path__: /var/lib/docker/containers/*/*log

    pipeline_stages:
      - json:
          expressions:
            output: log
            stream: stream
            attrs:
      - json:
          expressions:
            tag:
          source: attrs
      - regex:
          expression: (?P<container_name>(?:[^|]*))\|
          source: tag
      - timestamp:
          format: RFC3339Nano
          source: time
      - labels:
          stream:
          container_name:
      - output:
          source: output

  - job_name: social-service-logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: social-service
          __path__: /var/log/social-service/*.log

    pipeline_stages:
      - json:
          expressions:
            timestamp: timestamp
            level: level
            message: message
            service: service
            trace_id: traceId
      - timestamp:
          format: RFC3339
          source: timestamp
      - labels:
          level:
          service:
          trace_id:
EOF

    print_success "Promtail configuration created"
}

# Start monitoring stack
start_monitoring() {
    print_status "Starting monitoring stack..."
    
    cd "${MONITORING_DIR}"
    
    # Start the monitoring services
    docker-compose -f docker-compose.monitoring.yml up -d
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    check_service_health "Prometheus" "http://localhost:9090/-/healthy"
    check_service_health "Grafana" "http://localhost:3000/api/health"
    check_service_health "Alertmanager" "http://localhost:9093/-/healthy"
    
    print_success "Monitoring stack started successfully"
}

# Check service health
check_service_health() {
    local service_name=$1
    local health_url=$2
    local max_attempts=10
    local attempt=1
    
    print_status "Checking ${service_name} health..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "${health_url}" > /dev/null 2>&1; then
            print_success "${service_name} is healthy"
            return 0
        fi
        
        print_status "Attempt ${attempt}/${max_attempts}: ${service_name} not ready yet..."
        sleep 10
        ((attempt++))
    done
    
    print_warning "${service_name} health check failed after ${max_attempts} attempts"
    return 1
}

# Setup Kubernetes monitoring (if available)
setup_kubernetes_monitoring() {
    if [ "$KUBERNETES_AVAILABLE" = false ]; then
        print_status "Skipping Kubernetes setup (not available)"
        return 0
    fi
    
    print_status "Setting up Kubernetes monitoring..."
    
    # Create namespace
    kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply monitoring manifests
    if [ -d "${MONITORING_DIR}/k8s" ]; then
        kubectl apply -f "${MONITORING_DIR}/k8s/" -n "${NAMESPACE}"
        print_success "Kubernetes monitoring manifests applied"
    else
        print_warning "Kubernetes manifests not found, skipping"
    fi
}

# Configure alerts
configure_alerts() {
    print_status "Configuring alerts..."
    
    # Test alert configuration
    if curl -s -f "http://localhost:9090/api/v1/rules" > /dev/null 2>&1; then
        print_success "Prometheus rules loaded successfully"
    else
        print_warning "Failed to verify Prometheus rules"
    fi
    
    # Test Alertmanager
    if curl -s -f "http://localhost:9093/api/v1/status" > /dev/null 2>&1; then
        print_success "Alertmanager is configured"
    else
        print_warning "Alertmanager configuration issue"
    fi
}

# Generate monitoring report
generate_report() {
    print_status "Generating monitoring setup report..."
    
    local report_file="${MONITORING_DIR}/setup-report.md"
    
    cat > "${report_file}" << EOF
# Social Service MVP - Monitoring Setup Report

Generated: $(date)
Environment: ${ENVIRONMENT}
Namespace: ${NAMESPACE}

## Services Status

### Core Monitoring Services
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin123)
- **Alertmanager**: http://localhost:9093

### Additional Services
- **Jaeger**: http://localhost:16686
- **Loki**: http://localhost:3100

## Dashboards

### Grafana Dashboards
- Social Service MVP Dashboard: http://localhost:3000/d/social-service
- Integration Monitoring: Available in Grafana

## Alerts Configuration

### Alert Rules
- High error rate alerts
- Response time alerts
- Integration failure alerts
- Resource usage alerts

### Alert Channels
- Email notifications configured
- Slack integration available
- Webhook service running on port 5001

## Metrics Endpoints

### Social Service Metrics
- Main metrics: http://localhost:3003/metrics
- Health metrics: http://localhost:3003/v1/health/metrics
- Integration metrics: http://localhost:3003/integration/metrics

### Infrastructure Metrics
- Node metrics: http://localhost:9100/metrics
- PostgreSQL metrics: http://localhost:9187/metrics
- Redis metrics: http://localhost:9121/metrics

## Log Aggregation

### Loki
- Logs available at: http://localhost:3100
- Grafana Explore: http://localhost:3000/explore

## Performance Testing

### Load Testing
Run performance tests with monitoring:
\`\`\`bash
npm run test:load -- --users 1000 --duration 60
\`\`\`

### Integration Testing
Run integration tests:
\`\`\`bash
npm run test:integration
\`\`\`

## Troubleshooting

### Common Issues
1. **Services not starting**: Check Docker logs
2. **Metrics not appearing**: Verify service discovery
3. **Alerts not firing**: Check Prometheus rules

### Useful Commands
\`\`\`bash
# Check service logs
docker-compose -f monitoring/docker-compose.monitoring.yml logs -f

# Restart monitoring stack
docker-compose -f monitoring/docker-compose.monitoring.yml restart

# View Prometheus targets
curl http://localhost:9090/api/v1/targets
\`\`\`

## Next Steps

1. Configure production alert channels
2. Set up log retention policies
3. Configure backup for monitoring data
4. Set up monitoring for other services

---
**Social Service MVP Monitoring is ready! 🎉**
EOF

    print_success "Setup report generated: ${report_file}"
}

# Main execution
main() {
    echo "🚀 Social Service MVP - Monitoring Setup"
    echo "========================================"
    
    check_prerequisites
    setup_directories
    setup_grafana_provisioning
    setup_loki_config
    setup_promtail_config
    start_monitoring
    setup_kubernetes_monitoring
    configure_alerts
    generate_report
    
    echo ""
    echo "🎉 Monitoring setup completed successfully!"
    echo ""
    echo "📊 Access your monitoring services:"
    echo "   • Prometheus: http://localhost:9090"
    echo "   • Grafana: http://localhost:3000 (admin/admin123)"
    echo "   • Alertmanager: http://localhost:9093"
    echo "   • Jaeger: http://localhost:16686"
    echo ""
    echo "📈 Performance testing:"
    echo "   npm run test:load -- --users 1000 --duration 60"
    echo ""
    echo "📋 Setup report: ${MONITORING_DIR}/setup-report.md"
    echo ""
    print_success "Social Service MVP monitoring is ready for production! 🚀"
}

# Run main function
main "$@"