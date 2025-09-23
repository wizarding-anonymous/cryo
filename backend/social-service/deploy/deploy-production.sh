#!/bin/bash

# Social Service Production Deployment Script
# This script deploys the Social Service to Kubernetes with production configuration

set -e

# Configuration
NAMESPACE=${NAMESPACE:-default}
IMAGE_TAG=${IMAGE_TAG:-latest}
REGISTRY=${REGISTRY:-social-service}

echo "🚀 Starting Social Service production deployment..."
echo "Namespace: $NAMESPACE"
echo "Image Tag: $IMAGE_TAG"
echo "Registry: $REGISTRY"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed or not in PATH"
    exit 1
fi

# Check if we can connect to the cluster
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster"
    exit 1
fi

# Create namespace if it doesn't exist
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Apply ConfigMap first
echo "📝 Applying ConfigMap..."
kubectl apply -f k8s/configmap.yaml -n $NAMESPACE

# Check if secrets exist (they should be created manually for security)
if ! kubectl get secret social-service-secrets -n $NAMESPACE &> /dev/null; then
    echo "⚠️  Warning: social-service-secrets not found. Please create it manually:"
    echo "kubectl create secret generic social-service-secrets \\"
    echo "  --from-literal=DATABASE_HOST=your-db-host \\"
    echo "  --from-literal=DATABASE_USERNAME=your-db-user \\"
    echo "  --from-literal=DATABASE_PASSWORD=your-db-password \\"
    echo "  --from-literal=REDIS_HOST=your-redis-host \\"
    echo "  --from-literal=REDIS_PASSWORD=your-redis-password \\"
    echo "  --from-literal=INTERNAL_API_TOKEN=your-internal-token \\"
    echo "  --from-literal=JWT_SECRET=your-jwt-secret \\"
    echo "  -n $NAMESPACE"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update deployment image
echo "🔄 Updating deployment image..."
sed -i.bak "s|image: social-service:latest|image: $REGISTRY:$IMAGE_TAG|g" k8s/deployment.yaml

# Apply Kubernetes resources
echo "📦 Applying Kubernetes resources..."
kubectl apply -f k8s/deployment.yaml -n $NAMESPACE
kubectl apply -f k8s/service.yaml -n $NAMESPACE
kubectl apply -f k8s/hpa.yaml -n $NAMESPACE
kubectl apply -f k8s/pdb.yaml -n $NAMESPACE
kubectl apply -f k8s/networkpolicy.yaml -n $NAMESPACE

# Restore original deployment file
mv k8s/deployment.yaml.bak k8s/deployment.yaml

# Wait for deployment to be ready
echo "⏳ Waiting for deployment to be ready..."
kubectl rollout status deployment/social-service -n $NAMESPACE --timeout=300s

# Check if pods are running
echo "🔍 Checking pod status..."
kubectl get pods -l app=social-service -n $NAMESPACE

# Test health endpoint
echo "🏥 Testing health endpoint..."
kubectl port-forward service/social-service 8080:80 -n $NAMESPACE &
PORT_FORWARD_PID=$!

sleep 5

if curl -f http://localhost:8080/v1/health > /dev/null 2>&1; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed!"
fi

# Clean up port forward
kill $PORT_FORWARD_PID 2>/dev/null || true

echo "🎉 Social Service deployment completed successfully!"
echo ""
echo "📊 Deployment information:"
kubectl get deployment social-service -n $NAMESPACE
echo ""
echo "🔗 Service information:"
kubectl get service social-service -n $NAMESPACE
echo ""
echo "📈 HPA information:"
kubectl get hpa social-service-hpa -n $NAMESPACE
echo ""
echo "🛡️  PDB information:"
kubectl get pdb social-service-pdb -n $NAMESPACE

echo ""
echo "📝 Useful commands:"
echo "  View logs: kubectl logs -f deployment/social-service -n $NAMESPACE"
echo "  Scale deployment: kubectl scale deployment social-service --replicas=N -n $NAMESPACE"
echo "  Port forward: kubectl port-forward service/social-service 8080:80 -n $NAMESPACE"
echo "  Health check: curl http://localhost:8080/v1/health"