# Kubernetes Manifests Validation Script (PowerShell)
# This script validates the Kubernetes manifests for syntax and best practices

$ErrorActionPreference = "Stop"

Write-Host "🔍 Validating Kubernetes manifests..." -ForegroundColor Green

# Check if required tools are available
try {
    kubectl version --client | Out-Null
} catch {
    Write-Host "❌ kubectl is not installed" -ForegroundColor Red
    exit 1
}

# Validate YAML syntax
Write-Host "📝 Checking YAML syntax..." -ForegroundColor Yellow
Get-ChildItem -Filter "*.yaml" | ForEach-Object {
    Write-Host "  Checking $($_.Name)..." -ForegroundColor Gray
    try {
        kubectl apply --dry-run=client --validate=false -f $_.Name 2>$null | Out-Null
    } catch {
        Write-Host "❌ YAML syntax error in $($_.Name)" -ForegroundColor Red
        exit 1
    }
}

# Validate kustomization
Write-Host "📦 Validating kustomization..." -ForegroundColor Yellow
try {
    kubectl kustomize . | Out-Null
} catch {
    Write-Host "❌ Kustomization validation failed" -ForegroundColor Red
    exit 1
}

# Check for required resources
Write-Host "🔧 Checking required resources..." -ForegroundColor Yellow
$requiredFiles = @(
    "namespace.yaml",
    "configmap.yaml", 
    "deployment.yaml",
    "service.yaml",
    "ingress.yaml",
    "hpa.yaml",
    "pdb.yaml",
    "networkpolicy.yaml",
    "servicemonitor.yaml",
    "kustomization.yaml"
)

foreach ($file in $requiredFiles) {
    if (!(Test-Path $file)) {
        Write-Host "❌ Missing required file: $file" -ForegroundColor Red
        exit 1
    }
}

# Validate deployment configuration
Write-Host "🚀 Validating deployment configuration..." -ForegroundColor Yellow

# Check if health check endpoints are configured
if (!(Select-String -Path "deployment.yaml" -Pattern "/api/health" -Quiet)) {
    Write-Host "❌ Health check endpoint not configured in deployment" -ForegroundColor Red
    exit 1
}

# Check if resource limits are set
if (!(Select-String -Path "deployment.yaml" -Pattern "limits:" -Quiet)) {
    Write-Host "❌ Resource limits not configured in deployment" -ForegroundColor Red
    exit 1
}

# Check if HPA is properly configured
if (!(Select-String -Path "hpa.yaml" -Pattern "minReplicas:" -Quiet)) {
    Write-Host "❌ HPA minReplicas not configured" -ForegroundColor Red
    exit 1
}

# Check if ingress has proper annotations
if (!(Select-String -Path "ingress.yaml" -Pattern "nginx.ingress.kubernetes.io" -Quiet)) {
    Write-Host "❌ Ingress annotations not configured" -ForegroundColor Red
    exit 1
}

# Validate service configuration
if (!(Select-String -Path "service.yaml" -Pattern "ClusterIP" -Quiet)) {
    Write-Host "❌ Service type not properly configured" -ForegroundColor Red
    exit 1
}

Write-Host "✅ All validations passed!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Summary:" -ForegroundColor Cyan
Write-Host "  - YAML syntax: ✅" -ForegroundColor Green
Write-Host "  - Kustomization: ✅" -ForegroundColor Green
Write-Host "  - Required files: ✅" -ForegroundColor Green
Write-Host "  - Health checks: ✅" -ForegroundColor Green
Write-Host "  - Resource limits: ✅" -ForegroundColor Green
Write-Host "  - HPA configuration: ✅" -ForegroundColor Green
Write-Host "  - Ingress configuration: ✅" -ForegroundColor Green
Write-Host "  - Service configuration: ✅" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Ready for deployment!" -ForegroundColor Green