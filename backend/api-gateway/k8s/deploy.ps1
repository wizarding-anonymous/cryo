# API Gateway Kubernetes Deployment Script (PowerShell)
# This script deploys the API Gateway to Kubernetes cluster

$ErrorActionPreference = "Stop"

$NAMESPACE = "cryo"
$APP_NAME = "api-gateway"

Write-Host "🚀 Deploying API Gateway to Kubernetes..." -ForegroundColor Green

# Check if kubectl is available
try {
    kubectl version --client --short | Out-Null
} catch {
    Write-Host "❌ kubectl is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if cluster is accessible
try {
    kubectl cluster-info | Out-Null
} catch {
    Write-Host "❌ Cannot connect to Kubernetes cluster" -ForegroundColor Red
    exit 1
}

# Apply all manifests using kustomize
Write-Host "📦 Applying Kubernetes manifests..." -ForegroundColor Yellow
kubectl apply -k .

# Wait for deployment to be ready
Write-Host "⏳ Waiting for deployment to be ready..." -ForegroundColor Yellow
kubectl wait --for=condition=available --timeout=300s deployment/$APP_NAME -n $NAMESPACE

# Check pod status
Write-Host "📊 Pod status:" -ForegroundColor Cyan
kubectl get pods -l app=$APP_NAME -n $NAMESPACE

# Check service status
Write-Host "🌐 Service status:" -ForegroundColor Cyan
kubectl get svc $APP_NAME -n $NAMESPACE

# Check HPA status
Write-Host "📈 HPA status:" -ForegroundColor Cyan
kubectl get hpa $APP_NAME -n $NAMESPACE

# Check ingress status
Write-Host "🔗 Ingress status:" -ForegroundColor Cyan
kubectl get ingress $APP_NAME -n $NAMESPACE

Write-Host "✅ API Gateway deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🔍 To check logs:" -ForegroundColor Yellow
Write-Host "kubectl logs -f deployment/$APP_NAME -n $NAMESPACE"
Write-Host ""
Write-Host "🏥 To check health:" -ForegroundColor Yellow
Write-Host "kubectl port-forward svc/$APP_NAME 3001:3001 -n $NAMESPACE"
Write-Host "curl http://localhost:3001/api/health"