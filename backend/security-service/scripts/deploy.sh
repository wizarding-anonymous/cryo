#!/bin/bash

# Security Service Deployment Script
# This script provides easy deployment options for different environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="development"
NAMESPACE="default"
REGISTRY="your-registry"
TAG="latest"
HELM_RELEASE="security-service"

# Function to print colored output
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

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --environment    Environment (development|staging|production) [default: development]"
    echo "  -n, --namespace      Kubernetes namespace [default: default]"
    echo "  -r, --registry       Docker registry [default: your-registry]"
    echo "  -t, --tag           Docker image tag [default: latest]"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Commands:"
    echo "  docker              Build and run with Docker Compose"
    echo "  k8s                 Deploy to Kubernetes using kubectl"
    echo "  helm                Deploy using Helm chart"
    echo "  build               Build Docker image only"
    echo "  test                Run tests in Docker"
    echo "  clean               Clean up resources"
    echo ""
    echo "Examples:"
    echo "  $0 docker                                    # Run with Docker Compose"
    echo "  $0 helm -e production -n security-prod      # Deploy to production with Helm"
    echo "  $0 k8s -e staging -n security-staging       # Deploy to staging with kubectl"
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
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        docker|k8s|helm|build|test|clean)
            COMMAND="$1"
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Check if command is provided
if [ -z "$COMMAND" ]; then
    print_error "No command specified"
    show_usage
    exit 1
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    print_error "Valid environments: development, staging, production"
    exit 1
fi

# Function to build Docker image
build_image() {
    print_status "Building Docker image..."
    docker build -t "${REGISTRY}/security-service:${TAG}" .
    print_success "Docker image built successfully"
}

# Function to run with Docker Compose
run_docker() {
    print_status "Starting Security Service with Docker Compose..."
    
    # Check if .env file exists
    if [ ! -f .env ]; then
        print_warning ".env file not found, copying from .env.example"
        cp .env.example .env
    fi
    
    # Build and start services
    docker-compose up --build -d
    
    print_success "Security Service started successfully"
    print_status "Services running:"
    docker-compose ps
    
    print_status "Logs can be viewed with: docker-compose logs -f"
    print_status "Stop services with: docker-compose down"
}

# Function to deploy with kubectl
deploy_k8s() {
    print_status "Deploying to Kubernetes with kubectl..."
    
    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply Kubernetes manifests
    print_status "Applying Kubernetes manifests..."
    kubectl apply -f k8s/ -n "$NAMESPACE"
    
    # Wait for deployment to be ready
    print_status "Waiting for deployment to be ready..."
    kubectl rollout status deployment/security-service -n "$NAMESPACE" --timeout=300s
    
    print_success "Deployment completed successfully"
    
    # Show deployment status
    kubectl get pods -n "$NAMESPACE" -l app=security-service
}

# Function to deploy with Helm
deploy_helm() {
    print_status "Deploying with Helm..."
    
    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Set values file based on environment
    VALUES_FILE="helm/security-service/values-${ENVIRONMENT}.yaml"
    if [ ! -f "$VALUES_FILE" ]; then
        VALUES_FILE="helm/security-service/values.yaml"
        print_warning "Environment-specific values file not found, using default values.yaml"
    fi
    
    # Deploy with Helm
    helm upgrade --install "$HELM_RELEASE" helm/security-service \
        --namespace "$NAMESPACE" \
        --values "$VALUES_FILE" \
        --set image.repository="$REGISTRY/security-service" \
        --set image.tag="$TAG" \
        --wait \
        --timeout=10m
    
    print_success "Helm deployment completed successfully"
    
    # Show deployment status
    helm status "$HELM_RELEASE" -n "$NAMESPACE"
}

# Function to run tests
run_tests() {
    print_status "Running tests in Docker..."
    
    # Build test image
    docker build -t security-service-test --target dependencies .
    
    # Run tests
    docker run --rm \
        -v "$(pwd):/usr/src/app" \
        -w /usr/src/app \
        security-service-test \
        npm test
    
    print_success "Tests completed successfully"
}

# Function to clean up resources
cleanup() {
    print_status "Cleaning up resources..."
    
    case "$ENVIRONMENT" in
        development)
            print_status "Stopping Docker Compose services..."
            docker-compose down -v
            docker system prune -f
            ;;
        *)
            print_status "Cleaning up Kubernetes resources..."
            if command -v helm &> /dev/null; then
                helm uninstall "$HELM_RELEASE" -n "$NAMESPACE" || true
            fi
            kubectl delete -f k8s/ -n "$NAMESPACE" || true
            ;;
    esac
    
    print_success "Cleanup completed"
}

# Main execution
print_status "Security Service Deployment"
print_status "Environment: $ENVIRONMENT"
print_status "Namespace: $NAMESPACE"
print_status "Registry: $REGISTRY"
print_status "Tag: $TAG"
print_status "Command: $COMMAND"
echo ""

case "$COMMAND" in
    build)
        build_image
        ;;
    docker)
        run_docker
        ;;
    k8s)
        build_image
        deploy_k8s
        ;;
    helm)
        build_image
        deploy_helm
        ;;
    test)
        run_tests
        ;;
    clean)
        cleanup
        ;;
    *)
        print_error "Unknown command: $COMMAND"
        show_usage
        exit 1
        ;;
esac

print_success "Operation completed successfully!"