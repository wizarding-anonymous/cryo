#!/bin/bash

# User Service Deployment Script
# This script handles deployment to different environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="development"
NAMESPACE="user-service"
IMAGE_TAG="latest"
HELM_RELEASE="user-service"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -e, --environment    Environment (development|staging|production) [default: development]"
    echo "  -n, --namespace      Kubernetes namespace [default: user-service]"
    echo "  -t, --tag           Docker image tag [default: latest]"
    echo "  -r, --release       Helm release name [default: user-service]"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e production -t v1.2.3"
    echo "  $0 --environment staging --namespace user-service-staging"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -r|--release)
            HELM_RELEASE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    print_error "Must be one of: development, staging, production"
    exit 1
fi

print_status "Starting deployment to $ENVIRONMENT environment"
print_status "Namespace: $NAMESPACE"
print_status "Image tag: $IMAGE_TAG"
print_status "Helm release: $HELM_RELEASE"

# Check prerequisites
print_status "Checking prerequisites..."

# Check if kubectl is installed and configured
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check if helm is installed
if ! command -v helm &> /dev/null; then
    print_error "helm is not installed or not in PATH"
    exit 1
fi

# Check if we can connect to Kubernetes cluster
if ! kubectl cluster-info &> /dev/null; then
    print_error "Cannot connect to Kubernetes cluster"
    exit 1
fi

print_status "Prerequisites check passed"

# Create namespace if it doesn't exist
print_status "Ensuring namespace $NAMESPACE exists..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Deploy using Helm
print_status "Deploying User Service using Helm..."

# Set values file based on environment
VALUES_FILE="helm/user-service/values-${ENVIRONMENT}.yaml"
if [[ ! -f "$VALUES_FILE" ]]; then
    print_warning "Environment-specific values file not found: $VALUES_FILE"
    print_warning "Using default values.yaml"
    VALUES_FILE="helm/user-service/values.yaml"
fi

# Helm upgrade/install command
helm upgrade --install $HELM_RELEASE ./helm/user-service \
    --namespace $NAMESPACE \
    --values $VALUES_FILE \
    --set image.tag=$IMAGE_TAG \
    --set environment=$ENVIRONMENT \
    --wait \
    --timeout=10m

if [[ $? -eq 0 ]]; then
    print_status "Deployment successful!"
else
    print_error "Deployment failed!"
    exit 1
fi

# Wait for rollout to complete
print_status "Waiting for deployment to be ready..."
kubectl rollout status deployment/$HELM_RELEASE --namespace=$NAMESPACE --timeout=300s

# Run health check
print_status "Running health check..."
sleep 10

# Get service URL
SERVICE_URL=$(kubectl get ingress $HELM_RELEASE-ingress -n $NAMESPACE -o jsonpath='{.spec.rules[0].host}' 2>/dev/null || echo "localhost")

# Health check
if kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=user-service | grep -q "Running"; then
    print_status "Health check passed - pods are running"
    
    # Try to access health endpoint
    if command -v curl &> /dev/null; then
        if curl -f -s "http://$SERVICE_URL/health" > /dev/null 2>&1; then
            print_status "Health endpoint is responding"
        else
            print_warning "Health endpoint is not responding yet (this is normal for new deployments)"
        fi
    fi
else
    print_error "Health check failed - pods are not running"
    kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=user-service
    exit 1
fi

# Show deployment info
print_status "Deployment completed successfully!"
echo ""
echo "Deployment Information:"
echo "  Environment: $ENVIRONMENT"
echo "  Namespace: $NAMESPACE"
echo "  Release: $HELM_RELEASE"
echo "  Image Tag: $IMAGE_TAG"
echo "  Service URL: http://$SERVICE_URL"
echo ""
echo "Useful commands:"
echo "  kubectl get pods -n $NAMESPACE"
echo "  kubectl logs -f deployment/$HELM_RELEASE -n $NAMESPACE"
echo "  helm status $HELM_RELEASE -n $NAMESPACE"
echo "  kubectl port-forward svc/$HELM_RELEASE 3000:80 -n $NAMESPACE"