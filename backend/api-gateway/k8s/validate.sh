#!/bin/bash

# Kubernetes Manifests Validation Script
# This script validates the Kubernetes manifests for syntax and best practices

set -e

echo "🔍 Validating Kubernetes manifests..."

# Check if required tools are available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed"
    exit 1
fi

# Validate YAML syntax
echo "📝 Checking YAML syntax..."
for file in *.yaml; do
    if [[ -f "$file" ]]; then
        echo "  Checking $file..."
        # Use kubectl to validate YAML syntax
        kubectl apply --dry-run=client --validate=false -f "$file" > /dev/null 2>&1 || {
            echo "❌ YAML syntax error in $file"
            exit 1
        }
    fi
done

# Validate kustomization
echo "📦 Validating kustomization..."
kubectl kustomize . > /dev/null || {
    echo "❌ Kustomization validation failed"
    exit 1
}

# Check for required resources
echo "🔧 Checking required resources..."
required_files=(
    "namespace.yaml"
    "configmap.yaml" 
    "deployment.yaml"
    "service.yaml"
    "ingress.yaml"
    "hpa.yaml"
    "pdb.yaml"
    "networkpolicy.yaml"
    "servicemonitor.yaml"
    "kustomization.yaml"
)

for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
        echo "❌ Missing required file: $file"
        exit 1
    fi
done

# Validate deployment configuration
echo "🚀 Validating deployment configuration..."

# Check if health check endpoints are configured
if ! grep -q "/api/health" deployment.yaml; then
    echo "❌ Health check endpoint not configured in deployment"
    exit 1
fi

# Check if resource limits are set
if ! grep -q "limits:" deployment.yaml; then
    echo "❌ Resource limits not configured in deployment"
    exit 1
fi

# Check if HPA is properly configured
if ! grep -q "minReplicas:" hpa.yaml; then
    echo "❌ HPA minReplicas not configured"
    exit 1
fi

# Check if ingress has proper annotations
if ! grep -q "nginx.ingress.kubernetes.io" ingress.yaml; then
    echo "❌ Ingress annotations not configured"
    exit 1
fi

# Validate service configuration
if ! grep -q "ClusterIP" service.yaml; then
    echo "❌ Service type not properly configured"
    exit 1
fi

echo "✅ All validations passed!"
echo ""
echo "📋 Summary:"
echo "  - YAML syntax: ✅"
echo "  - Kustomization: ✅"
echo "  - Required files: ✅"
echo "  - Health checks: ✅"
echo "  - Resource limits: ✅"
echo "  - HPA configuration: ✅"
echo "  - Ingress configuration: ✅"
echo "  - Service configuration: ✅"
echo ""
echo "🚀 Ready for deployment!"