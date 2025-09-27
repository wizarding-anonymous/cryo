#!/bin/bash

# Production deployment script for Review Service
set -e

echo "🚀 Starting Review Service production deployment..."

# Configuration
NAMESPACE="review-service"
IMAGE_TAG=${1:-latest}
REGISTRY=${REGISTRY:-"your-registry.com"}
IMAGE_NAME="${REGISTRY}/review-service:${IMAGE_TAG}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed"
        exit 1
    fi
    
    # Check if we can connect to Kubernetes cluster
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Build and push Docker image
build_and_push() {
    log_info "Building Docker image: ${IMAGE_NAME}"
    
    # Build optimized production image
    docker build -t "${IMAGE_NAME}" --target production .
    
    if [ $? -ne 0 ]; then
        log_error "Docker build failed"
        exit 1
    fi
    
    log_info "Pushing image to registry..."
    docker push "${IMAGE_NAME}"
    
    if [ $? -ne 0 ]; then
        log_error "Docker push failed"
        exit 1
    fi
    
    log_info "Image built and pushed successfully"
}

# Deploy to Kubernetes
deploy_to_k8s() {
    log_info "Deploying to Kubernetes..."
    
    # Create namespace if it doesn't exist
    kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply Kubernetes manifests
    log_info "Applying ConfigMap..."
    kubectl apply -f k8s/configmap.yaml
    
    log_info "Applying Secret..."
    kubectl apply -f k8s/secret.yaml
    
    log_info "Applying Service..."
    kubectl apply -f k8s/service.yaml
    
    # Update deployment with new image
    log_info "Updating deployment with image: ${IMAGE_NAME}"
    kubectl set image deployment/review-service review-service="${IMAGE_NAME}" -n "${NAMESPACE}"
    
    # Apply deployment (in case it doesn't exist)
    kubectl apply -f k8s/deployment.yaml
    
    # Apply HPA
    log_info "Applying HorizontalPodAutoscaler..."
    kubectl apply -f k8s/hpa.yaml
    
    # Apply ServiceMonitor if Prometheus is available
    if kubectl get crd servicemonitors.monitoring.coreos.com &> /dev/null; then
        log_info "Applying ServiceMonitor..."
        kubectl apply -f k8s/servicemonitor.yaml
    else
        log_warn "ServiceMonitor CRD not found, skipping monitoring setup"
    fi
}

# Wait for deployment to be ready
wait_for_deployment() {
    log_info "Waiting for deployment to be ready..."
    
    kubectl rollout status deployment/review-service -n "${NAMESPACE}" --timeout=300s
    
    if [ $? -ne 0 ]; then
        log_error "Deployment failed to become ready"
        exit 1
    fi
    
    log_info "Deployment is ready"
}

# Run health checks
health_check() {
    log_info "Running health checks..."
    
    # Get service endpoint
    SERVICE_IP=$(kubectl get service review-service -n "${NAMESPACE}" -o jsonpath='{.spec.clusterIP}')
    
    # Port forward for health check (in background)
    kubectl port-forward service/review-service 8080:3004 -n "${NAMESPACE}" &
    PORT_FORWARD_PID=$!
    
    # Wait a moment for port forward to establish
    sleep 5
    
    # Health check
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        log_info "Health check passed"
    else
        log_error "Health check failed"
        kill $PORT_FORWARD_PID 2>/dev/null
        exit 1
    fi
    
    # Detailed health check
    if curl -f http://localhost:8080/health/detailed > /dev/null 2>&1; then
        log_info "Detailed health check passed"
    else
        log_warn "Detailed health check failed - some integrations may be unavailable"
    fi
    
    # Clean up port forward
    kill $PORT_FORWARD_PID 2>/dev/null
}

# Load testing
run_load_test() {
    if [ "$RUN_LOAD_TEST" = "true" ]; then
        log_info "Running load test..."
        
        # Port forward for load testing
        kubectl port-forward service/review-service 8080:3004 -n "${NAMESPACE}" &
        PORT_FORWARD_PID=$!
        
        sleep 5
        
        # Run load test
        cd load-test
        BASE_URL=http://localhost:8080 k6 run load-test.js
        
        if [ $? -eq 0 ]; then
            log_info "Load test passed"
        else
            log_error "Load test failed"
            kill $PORT_FORWARD_PID 2>/dev/null
            exit 1
        fi
        
        kill $PORT_FORWARD_PID 2>/dev/null
        cd ..
    else
        log_info "Skipping load test (set RUN_LOAD_TEST=true to enable)"
    fi
}

# Cleanup on exit
cleanup() {
    if [ ! -z "$PORT_FORWARD_PID" ]; then
        kill $PORT_FORWARD_PID 2>/dev/null
    fi
}
trap cleanup EXIT

# Main deployment flow
main() {
    log_info "Review Service Production Deployment"
    log_info "Image: ${IMAGE_NAME}"
    log_info "Namespace: ${NAMESPACE}"
    
    check_prerequisites
    build_and_push
    deploy_to_k8s
    wait_for_deployment
    health_check
    run_load_test
    
    log_info "🎉 Deployment completed successfully!"
    log_info "Service is available at: kubectl get service review-service -n ${NAMESPACE}"
    log_info "Monitor with: kubectl logs -f deployment/review-service -n ${NAMESPACE}"
}

# Run main function
main "$@"