#!/bin/bash

# User Service Kubernetes Deployment Script
# This script deploys the User Service to Kubernetes with proper health checks and monitoring

set -e

# Configuration
NAMESPACE="microservices"
SERVICE_NAME="user-service"
DEPLOYMENT_NAME="user-service-deployment"
TIMEOUT="300s"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if we can connect to the cluster
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "kubectl is available and connected to cluster"
}

# Check if namespace exists, create if not
ensure_namespace() {
    if kubectl get namespace $NAMESPACE &> /dev/null; then
        log_info "Namespace $NAMESPACE already exists"
    else
        log_info "Creating namespace $NAMESPACE"
        kubectl create namespace $NAMESPACE
        log_success "Namespace $NAMESPACE created"
    fi
}

# Apply Kubernetes manifests
apply_manifests() {
    log_info "Applying Kubernetes manifests..."
    
    # Apply in order to handle dependencies
    local manifests=(
        "namespace.yaml"
        "serviceaccount.yaml"
        "configmap.yaml"
        "secret.yaml"
        "networkpolicy.yaml"
        "service.yaml"
        "deployment.yaml"
        "hpa.yaml"
        "vpa.yaml"
        "poddisruptionbudget.yaml"
        "servicemonitor.yaml"
        "prometheusrule.yaml"
        "grafana-dashboard.yaml"
    )
    
    for manifest in "${manifests[@]}"; do
        if [ -f "k8s/$manifest" ]; then
            log_info "Applying $manifest"
            kubectl apply -f "k8s/$manifest"
        else
            log_warning "Manifest $manifest not found, skipping"
        fi
    done
    
    log_success "All manifests applied"
}

# Wait for deployment to be ready
wait_for_deployment() {
    log_info "Waiting for deployment to be ready..."
    
    if kubectl rollout status deployment/$DEPLOYMENT_NAME -n $NAMESPACE --timeout=$TIMEOUT; then
        log_success "Deployment is ready"
    else
        log_error "Deployment failed to become ready within $TIMEOUT"
        
        # Show pod status for debugging
        log_info "Pod status:"
        kubectl get pods -n $NAMESPACE -l app=$SERVICE_NAME
        
        # Show recent events
        log_info "Recent events:"
        kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -10
        
        exit 1
    fi
}

# Verify service health
verify_health() {
    log_info "Verifying service health..."
    
    # Get service endpoint
    local service_ip=$(kubectl get service $SERVICE_NAME -n $NAMESPACE -o jsonpath='{.spec.clusterIP}')
    local service_port=$(kubectl get service $SERVICE_NAME -n $NAMESPACE -o jsonpath='{.spec.ports[0].port}')
    
    # Port forward for health check
    log_info "Setting up port forward for health check..."
    kubectl port-forward service/$SERVICE_NAME -n $NAMESPACE 8080:$service_port &
    local port_forward_pid=$!
    
    # Wait a moment for port forward to establish
    sleep 5
    
    # Health check
    local health_check_passed=false
    for i in {1..10}; do
        if curl -f http://localhost:8080/api/health/ready &> /dev/null; then
            health_check_passed=true
            break
        fi
        log_info "Health check attempt $i/10 failed, retrying in 5 seconds..."
        sleep 5
    done
    
    # Clean up port forward
    kill $port_forward_pid 2>/dev/null || true
    
    if [ "$health_check_passed" = true ]; then
        log_success "Service health check passed"
    else
        log_error "Service health check failed"
        exit 1
    fi
}

# Show deployment status
show_status() {
    log_info "Deployment Status:"
    echo "===================="
    
    # Deployment status
    kubectl get deployment $DEPLOYMENT_NAME -n $NAMESPACE -o wide
    echo
    
    # Pod status
    log_info "Pods:"
    kubectl get pods -n $NAMESPACE -l app=$SERVICE_NAME -o wide
    echo
    
    # Service status
    log_info "Services:"
    kubectl get service $SERVICE_NAME -n $NAMESPACE -o wide
    echo
    
    # HPA status
    log_info "HPA Status:"
    kubectl get hpa -n $NAMESPACE -l app=$SERVICE_NAME
    echo
    
    # Recent events
    log_info "Recent Events:"
    kubectl get events -n $NAMESPACE --field-selector involvedObject.name=$DEPLOYMENT_NAME --sort-by='.lastTimestamp' | tail -5
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null || true
}

# Set trap for cleanup
trap cleanup EXIT

# Main execution
main() {
    log_info "Starting User Service Kubernetes deployment..."
    
    # Change to script directory
    cd "$(dirname "$0")/.."
    
    # Pre-deployment checks
    check_kubectl
    ensure_namespace
    
    # Deploy
    apply_manifests
    wait_for_deployment
    verify_health
    
    # Show final status
    show_status
    
    log_success "User Service deployment completed successfully!"
    log_info "Service is available at: http://$SERVICE_NAME.$NAMESPACE.svc.cluster.local:3002"
    log_info "Health check: http://$SERVICE_NAME.$NAMESPACE.svc.cluster.local:3002/api/health"
    log_info "Metrics: http://$SERVICE_NAME.$NAMESPACE.svc.cluster.local:3002/api/metrics"
}

# Run main function
main "$@"