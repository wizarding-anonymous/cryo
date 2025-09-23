# Social Service Production Deployment Script (PowerShell)
# This script deploys the Social Service to Kubernetes with production configuration

param(
    [string]$Namespace = "default",
    [string]$ImageTag = "latest",
    [string]$Registry = "social-service"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Social Service production deployment..." -ForegroundColor Green
Write-Host "Namespace: $Namespace" -ForegroundColor Cyan
Write-Host "Image Tag: $ImageTag" -ForegroundColor Cyan
Write-Host "Registry: $Registry" -ForegroundColor Cyan

# Check if kubectl is available
try {
    kubectl version --client | Out-Null
} catch {
    Write-Host "❌ kubectl is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if we can connect to the cluster
try {
    kubectl cluster-info | Out-Null
} catch {
    Write-Host "❌ Cannot connect to Kubernetes cluster" -ForegroundColor Red
    exit 1
}

# Create namespace if it doesn't exist
Write-Host "📁 Creating namespace if needed..." -ForegroundColor Yellow
kubectl create namespace $Namespace --dry-run=client -o yaml | kubectl apply -f -

# Apply ConfigMap first
Write-Host "📝 Applying ConfigMap..." -ForegroundColor Yellow
kubectl apply -f k8s/configmap.yaml -n $Namespace

# Check if secrets exist
try {
    kubectl get secret social-service-secrets -n $Namespace | Out-Null
} catch {
    Write-Host "⚠️  Warning: social-service-secrets not found. Please create it manually:" -ForegroundColor Yellow
    Write-Host "kubectl create secret generic social-service-secrets \"
    Write-Host "  --from-literal=DATABASE_HOST=your-db-host \"
    Write-Host "  --from-literal=DATABASE_USERNAME=your-db-user \"
    Write-Host "  --from-literal=DATABASE_PASSWORD=your-db-password \"
    Write-Host "  --from-literal=REDIS_HOST=your-redis-host \"
    Write-Host "  --from-literal=REDIS_PASSWORD=your-redis-password \"
    Write-Host "  --from-literal=INTERNAL_API_TOKEN=your-internal-token \"
    Write-Host "  --from-literal=JWT_SECRET=your-jwt-secret \"
    Write-Host "  -n $Namespace"
    
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

# Update deployment image
Write-Host "🔄 Updating deployment image..." -ForegroundColor Yellow
$deploymentContent = Get-Content k8s/deployment.yaml -Raw
$updatedContent = $deploymentContent -replace "image: social-service:latest", "image: $Registry`:$ImageTag"
Set-Content k8s/deployment.yaml.tmp -Value $updatedContent

# Apply Kubernetes resources
Write-Host "📦 Applying Kubernetes resources..." -ForegroundColor Yellow
kubectl apply -f k8s/deployment.yaml.tmp -n $Namespace
kubectl apply -f k8s/service.yaml -n $Namespace
kubectl apply -f k8s/hpa.yaml -n $Namespace
kubectl apply -f k8s/pdb.yaml -n $Namespace
kubectl apply -f k8s/networkpolicy.yaml -n $Namespace

# Clean up temporary file
Remove-Item k8s/deployment.yaml.tmp

# Wait for deployment to be ready
Write-Host "⏳ Waiting for deployment to be ready..." -ForegroundColor Yellow
kubectl rollout status deployment/social-service -n $Namespace --timeout=300s

# Check if pods are running
Write-Host "🔍 Checking pod status..." -ForegroundColor Yellow
kubectl get pods -l app=social-service -n $Namespace

# Test health endpoint
Write-Host "🏥 Testing health endpoint..." -ForegroundColor Yellow
$portForwardJob = Start-Job -ScriptBlock {
    kubectl port-forward service/social-service 8080:80 -n $using:Namespace
}

Start-Sleep 5

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/v1/health" -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Health check passed!" -ForegroundColor Green
    } else {
        Write-Host "❌ Health check failed!" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Clean up port forward
Stop-Job $portForwardJob -ErrorAction SilentlyContinue
Remove-Job $portForwardJob -ErrorAction SilentlyContinue

Write-Host "🎉 Social Service deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Deployment information:" -ForegroundColor Cyan
kubectl get deployment social-service -n $Namespace
Write-Host ""
Write-Host "🔗 Service information:" -ForegroundColor Cyan
kubectl get service social-service -n $Namespace
Write-Host ""
Write-Host "📈 HPA information:" -ForegroundColor Cyan
kubectl get hpa social-service-hpa -n $Namespace
Write-Host ""
Write-Host "🛡️  PDB information:" -ForegroundColor Cyan
kubectl get pdb social-service-pdb -n $Namespace

Write-Host ""
Write-Host "📝 Useful commands:" -ForegroundColor Yellow
Write-Host "  View logs: kubectl logs -f deployment/social-service -n $Namespace"
Write-Host "  Scale deployment: kubectl scale deployment social-service --replicas=N -n $Namespace"
Write-Host "  Port forward: kubectl port-forward service/social-service 8080:80 -n $Namespace"
Write-Host "  Health check: curl http://localhost:8080/v1/health"