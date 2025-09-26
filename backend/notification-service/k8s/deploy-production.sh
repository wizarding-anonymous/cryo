#!/bin/bash

# Production Deployment Script for Notification Service
# This script deploys the notification service to Kubernetes with production configurations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE=${NAMESPACE:-default}
IMAGE_TAG=${IMAGE_TAG:-latest}
REGISTRY=${REGISTRY:-notification-service}

echo -e "${GREEN}🚀 Starting production deployment of Notification Service${NC}"
echo -e "${YELLOW}Namespace: ${NAMESPACE}${NC}"
echo -e "${YELLOW}Image Tag: ${IMAGE_TAG}${NC}"

# Function to check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}❌ kubectl is not installed or not in PATH${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ kubectl is available${NC}"
}

# Function to check cluster connectivity
check_cluster() {
    if ! kubectl cluster-info &> /dev/null; then
        echo -e "${RED}❌ Cannot connect to Kubernetes cluster${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Connected to Kubernetes cluster${NC}"
}

# Function to create namespace if it doesn't exist
create_namespace() {
    if ! kubectl get namespace ${NAMESPACE} &> /dev/null; then
        echo -e "${YELLOW}📦 Creating namespace: ${NAMESPACE}${NC}"
        kubectl create namespace ${NAMESPACE}
    else
        echo -e "${GREEN}✅ Namespace ${NAMESPACE} already exists${NC}"
    fi
}

# Function to apply Kubernetes manifests
apply_manifests() {
    echo -e "${YELLOW}📋 Applying Kubernetes manifests...${NC}"
    
    # Apply in order of dependencies
    kubectl apply -f serviceaccount.yaml -n ${NAMESPACE}
    kubectl apply -f secrets.yaml -n ${NAMESPACE}
    kubectl apply -f configmap.yaml -n ${NAMESPACE}
    kubectl apply -f service.yaml -n ${NAMESPACE}
    kubectl apply -f poddisruptionbudget.yaml -n ${NAMESPACE}
    
    # Update deployment with correct image tag
    sed "s|notification-service:latest|${REGISTRY}:${IMAGE_TAG}|g" deployment.yaml | kubectl apply -f - -n ${NAMESPACE}
    
    # Apply HPA
    kubectl apply -f horizontalpodautoscaler.yaml -n ${NAMESPACE}
    
    echo -e "${GREEN}✅ All manifests applied successfully${NC}"
}

# Function to wait for deployment to be ready
wait_for_deployment() {
    echo -e "${YELLOW}⏳ Waiting for deployment to be ready...${NC}"
    
    if kubectl rollout status deployment/notification-service-deployment -n ${NAMESPACE} --timeout=300s; then
        echo -e "${GREEN}✅ Deployment is ready${NC}"
    else
        echo -e "${RED}❌ Deployment failed or timed out${NC}"
        exit 1
    fi
}

# Function to run health checks
health_check() {
    echo -e "${YELLOW}🏥 Running health checks...${NC}"
    
    # Get service endpoint
    SERVICE_IP=$(kubectl get service notification-service -n ${NAMESPACE} -o jsonpath='{.spec.clusterIP}')
    
    # Port forward for health check (in background)
    kubectl port-forward service/notification-service 8080:3000 -n ${NAMESPACE} &
    PORT_FORWARD_PID=$!
    
    # Wait a moment for port forward to establish
    sleep 5
    
    # Health check
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Health check passed${NC}"
    else
        echo -e "${RED}❌ Health check failed${NC}"
        kill $PORT_FORWARD_PID 2>/dev/null || true
        exit 1
    fi
    
    # Clean up port forward
    kill $PORT_FORWARD_PID 2>/dev/null || true
}

# Function to display deployment info
show_deployment_info() {
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${YELLOW}📊 Deployment Information:${NC}"
    
    kubectl get pods -l app=notification-service -n ${NAMESPACE}
    echo ""
    kubectl get services -l app=notification-service -n ${NAMESPACE}
    echo ""
    kubectl get hpa -l app=notification-service -n ${NAMESPACE}
    
    echo -e "${YELLOW}📝 Useful commands:${NC}"
    echo "  View logs: kubectl logs -f deployment/notification-service-deployment -n ${NAMESPACE}"
    echo "  Scale deployment: kubectl scale deployment notification-service-deployment --replicas=5 -n ${NAMESPACE}"
    echo "  Port forward: kubectl port-forward service/notification-service 3000:3000 -n ${NAMESPACE}"
    echo "  Health check: curl http://localhost:3000/health"
}

# Main execution
main() {
    echo -e "${GREEN}🔍 Pre-deployment checks...${NC}"
    check_kubectl
    check_cluster
    
    echo -e "${GREEN}🚀 Starting deployment...${NC}"
    create_namespace
    apply_manifests
    wait_for_deployment
    health_check
    show_deployment_info
    
    echo -e "${GREEN}✨ Production deployment completed successfully!${NC}"
}

# Run main function
main "$@"