#!/bin/bash

# API Gateway Kubernetes Deployment Script
# This script deploys the API Gateway to Kubernetes cluster

set -e

NAMESPACE="cryo"
APP_NAME="api-gateway"

echo "🚀 Deploying API Gateway to Kubernetes..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed or not in PATH"
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster"
    exit 1
fi

# Apply all manifests using kustomize
echo "📦 Applying Kubernetes manifests..."
kubectl apply -k .

# Wait for deployment to be ready
echo "⏳ Waiting for deployment to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/${APP_NAME} -n ${NAMESPACE}

# Check pod status
echo "📊 Pod status:"
kubectl get pods -l app=${APP_NAME} -n ${NAMESPACE}

# Check service status
echo "🌐 Service status:"
kubectl get svc ${APP_NAME} -n ${NAMESPACE}

# Check HPA status
echo "📈 HPA status:"
kubectl get hpa ${APP_NAME} -n ${NAMESPACE}

# Check ingress status
echo "🔗 Ingress status:"
kubectl get ingress ${APP_NAME} -n ${NAMESPACE}

echo "✅ API Gateway deployment completed successfully!"
echo ""
echo "🔍 To check logs:"
echo "kubectl logs -f deployment/${APP_NAME} -n ${NAMESPACE}"
echo ""
echo "🏥 To check health:"
echo "kubectl port-forward svc/${APP_NAME} 3001:3001 -n ${NAMESPACE}"
echo "curl http://localhost:3001/api/health"