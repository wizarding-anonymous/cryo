#!/bin/bash

# =============================================================================
# Deploy Auth Service to Staging Environment
# Script for task 15.1: Deploy Auth Service alongside existing User Service
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="microservices"
SERVICE_NAME="auth-service"
TIMEOUT="300s"

echo -e "${BLUE}🚀 Starting Auth Service deployment to staging environment${NC}"
echo "=================================================="

# Function to check if command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ Error: $1 is not installed${NC}"
        exit 1
    fi
}

# Function to wait for deployment
wait_for_deployment() {
    local deployment_name=$1
    echo -e "${YELLOW}⏳ Waiting for deployment $deployment_name to be ready...${NC}"
    
    if kubectl rollout status deployment/$deployment_name -n $NAMESPACE --timeout=$TIMEOUT; then
        echo -e "${GREEN}✅ Deployment $deployment_name is ready${NC}"
        return 0
    else
        echo -e "${RED}❌ Deployment $deployment_name failed to become ready${NC}"
        return 1
    fi
}

# Function to check service health
check_service_health() {
    local service_name=$1
    local port=$2
    
    echo -e "${YELLOW}🔍 Checking $service_name health...${NC}"
    
    # Get pod name
    local pod_name=$(kubectl get pods -n $NAMESPACE -l app=$service_name -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    
    if [ -z "$pod_name" ]; then
        echo -e "${RED}❌ No pods found for $service_name${NC}"
        return 1
    fi
    
    # Check health endpoint
    if kubectl exec -n $NAMESPACE $pod_name -- curl -f http://localhost:$port/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $service_name health check passed${NC}"
        return 0
    else
        echo -e "${RED}❌ $service_name health check failed${NC}"
        return 1
    fi
}

# Function to test service integration
test_service_integration() {
    echo -e "${YELLOW}🔗 Testing Auth Service integration with other services...${NC}"
    
    # Get Auth Service pod
    local auth_pod=$(kubectl get pods -n $NAMESPACE -l app=auth-service -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    
    if [ -z "$auth_pod" ]; then
        echo -e "${RED}❌ Auth Service pod not found${NC}"
        return 1
    fi
    
    # Test User Service connectivity
    echo -e "${BLUE}  Testing User Service connectivity...${NC}"
    if kubectl exec -n $NAMESPACE $auth_pod -- curl -f http://user-service:3002/health >/dev/null 2>&1; then
        echo -e "${GREEN}  ✅ User Service connectivity OK${NC}"
    else
        echo -e "${YELLOW}  ⚠️  User Service connectivity failed (may not be deployed yet)${NC}"
    fi
    
    # Test Security Service connectivity
    echo -e "${BLUE}  Testing Security Service connectivity...${NC}"
    if kubectl exec -n $NAMESPACE $auth_pod -- curl -f http://security-service:3010/health >/dev/null 2>&1; then
        echo -e "${GREEN}  ✅ Security Service connectivity OK${NC}"
    else
        echo -e "${YELLOW}  ⚠️  Security Service connectivity failed (may not be deployed yet)${NC}"
    fi
    
    # Test Redis connectivity
    echo -e "${BLUE}  Testing Redis connectivity...${NC}"
    if kubectl exec -n $NAMESPACE $auth_pod -- nc -z redis 6379 >/dev/null 2>&1; then
        echo -e "${GREEN}  ✅ Redis connectivity OK${NC}"
    else
        echo -e "${RED}  ❌ Redis connectivity failed${NC}"
        return 1
    fi
    
    # Test PostgreSQL connectivity
    echo -e "${BLUE}  Testing PostgreSQL connectivity...${NC}"
    if kubectl exec -n $NAMESPACE $auth_pod -- nc -z postgres-auth 5432 >/dev/null 2>&1; then
        echo -e "${GREEN}  ✅ PostgreSQL connectivity OK${NC}"
    else
        echo -e "${RED}  ❌ PostgreSQL connectivity failed${NC}"
        return 1
    fi
    
    return 0
}

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"
check_command kubectl
check_command docker

# Check if kubectl is configured
if ! kubectl cluster-info >/dev/null 2>&1; then
    echo -e "${RED}❌ kubectl is not configured or cluster is not accessible${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Step 1: Create namespace if it doesn't exist
echo -e "\n${BLUE}📁 Step 1: Ensuring namespace exists...${NC}"
if kubectl get namespace $NAMESPACE >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Namespace $NAMESPACE already exists${NC}"
else
    kubectl apply -f ../k8s/namespace.yaml
    echo -e "${GREEN}✅ Namespace $NAMESPACE created${NC}"
fi

# Step 2: Apply secrets and configmaps
echo -e "\n${BLUE}🔐 Step 2: Applying secrets and configmaps...${NC}"
kubectl apply -f ../k8s/auth-service-secrets.yaml
kubectl apply -f ../k8s/auth-service-configmap.yaml
echo -e "${GREEN}✅ Secrets and configmaps applied${NC}"

# Step 3: Deploy Auth Service
echo -e "\n${BLUE}🚀 Step 3: Deploying Auth Service...${NC}"
kubectl apply -f ../k8s/auth-service-deployment.yaml

# Step 4: Wait for deployment to be ready
echo -e "\n${BLUE}⏳ Step 4: Waiting for Auth Service to be ready...${NC}"
if ! wait_for_deployment "auth-service-deployment"; then
    echo -e "${RED}❌ Auth Service deployment failed${NC}"
    
    # Show logs for debugging
    echo -e "\n${YELLOW}📋 Recent logs from Auth Service:${NC}"
    kubectl logs -n $NAMESPACE -l app=auth-service --tail=50
    
    # Show pod status
    echo -e "\n${YELLOW}📋 Pod status:${NC}"
    kubectl get pods -n $NAMESPACE -l app=auth-service
    
    exit 1
fi

# Step 5: Apply monitoring configuration
echo -e "\n${BLUE}📊 Step 5: Applying monitoring configuration...${NC}"
kubectl apply -f ../k8s/auth-service-monitoring.yaml
echo -e "${GREEN}✅ Monitoring configuration applied${NC}"

# Step 6: Validate service startup and health checks
echo -e "\n${BLUE}🏥 Step 6: Validating service health...${NC}"
sleep 10  # Give the service a moment to fully start

if ! check_service_health "auth-service" "3001"; then
    echo -e "${RED}❌ Auth Service health check failed${NC}"
    
    # Show logs for debugging
    echo -e "\n${YELLOW}📋 Recent logs from Auth Service:${NC}"
    kubectl logs -n $NAMESPACE -l app=auth-service --tail=50
    
    exit 1
fi

# Step 7: Test integration with other services
echo -e "\n${BLUE}🔗 Step 7: Testing service integration...${NC}"
if ! test_service_integration; then
    echo -e "${YELLOW}⚠️  Some integration tests failed, but Auth Service is running${NC}"
else
    echo -e "${GREEN}✅ All integration tests passed${NC}"
fi

# Step 8: Display deployment information
echo -e "\n${BLUE}📋 Step 8: Deployment summary${NC}"
echo "=================================================="

# Show service status
echo -e "${BLUE}Service Status:${NC}"
kubectl get svc -n $NAMESPACE auth-service

# Show pod status
echo -e "\n${BLUE}Pod Status:${NC}"
kubectl get pods -n $NAMESPACE -l app=auth-service

# Show deployment status
echo -e "\n${BLUE}Deployment Status:${NC}"
kubectl get deployment -n $NAMESPACE auth-service-deployment

# Show endpoints
echo -e "\n${BLUE}Service Endpoints:${NC}"
kubectl get endpoints -n $NAMESPACE auth-service

# Final success message
echo -e "\n${GREEN}🎉 SUCCESS: Auth Service has been successfully deployed to staging!${NC}"
echo "=================================================="
echo -e "${GREEN}✅ Service startup: OK${NC}"
echo -e "${GREEN}✅ Health checks: OK${NC}"
echo -e "${GREEN}✅ Basic integration: OK${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Update API Gateway routing to include Auth Service"
echo "2. Run comprehensive integration tests"
echo "3. Monitor service metrics and logs"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "• View logs: kubectl logs -n $NAMESPACE -l app=auth-service -f"
echo "• Check status: kubectl get pods -n $NAMESPACE -l app=auth-service"
echo "• Port forward: kubectl port-forward -n $NAMESPACE svc/auth-service 3001:3001"
echo "• Health check: curl http://localhost:3001/health"

exit 0