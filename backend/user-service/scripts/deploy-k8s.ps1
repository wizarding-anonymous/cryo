# User Service Kubernetes Deployment Script (PowerShell)
# This script deploys the User Service to Kubernetes with proper health checks and monitoring

param(
    [string]$Namespace = "microservices",
    [string]$ServiceName = "user-service",
    [string]$DeploymentName = "user-service-deployment",
    [string]$Timeout = "300s"
)

# Error handling
$ErrorActionPreference = "Stop"

# Functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if kubectl is available
function Test-Kubectl {
    try {
        $null = Get-Command kubectl -ErrorAction Stop
        $null = kubectl cluster-info 2>$null
        Write-Success "kubectl is available and connected to cluster"
        return $true
    }
    catch {
        Write-Error "kubectl is not installed or cannot connect to cluster"
        return $false
    }
}

# Check if namespace exists, create if not
function Ensure-Namespace {
    try {
        $null = kubectl get namespace $Namespace 2>$null
        Write-Info "Namespace $Namespace already exists"
    }
    catch {
        Write-Info "Creating namespace $Namespace"
        kubectl create namespace $Namespace
        Write-Success "Namespace $Namespace created"
    }
}

# Apply Kubernetes manifests
function Apply-Manifests {
    Write-Info "Applying Kubernetes manifests..."
    
    $manifests = @(
        "namespace.yaml",
        "serviceaccount.yaml",
        "configmap.yaml",
        "secret.yaml",
        "networkpolicy.yaml",
        "service.yaml",
        "deployment.yaml",
        "hpa.yaml",
        "vpa.yaml",
        "poddisruptionbudget.yaml",
        "servicemonitor.yaml",
        "prometheusrule.yaml",
        "grafana-dashboard.yaml"
    )
    
    foreach ($manifest in $manifests) {
        $manifestPath = "k8s\$manifest"
        if (Test-Path $manifestPath) {
            Write-Info "Applying $manifest"
            kubectl apply -f $manifestPath
        }
        else {
            Write-Warning "Manifest $manifest not found, skipping"
        }
    }
    
    Write-Success "All manifests applied"
}

# Wait for deployment to be ready
function Wait-ForDeployment {
    Write-Info "Waiting for deployment to be ready..."
    
    try {
        kubectl rollout status deployment/$DeploymentName -n $Namespace --timeout=$Timeout
        Write-Success "Deployment is ready"
    }
    catch {
        Write-Error "Deployment failed to become ready within $Timeout"
        
        # Show pod status for debugging
        Write-Info "Pod status:"
        kubectl get pods -n $Namespace -l app=$ServiceName
        
        # Show recent events
        Write-Info "Recent events:"
        kubectl get events -n $Namespace --sort-by='.lastTimestamp' | Select-Object -Last 10
        
        throw
    }
}

# Verify service health
function Test-ServiceHealth {
    Write-Info "Verifying service health..."
    
    # Get service details
    $servicePort = kubectl get service $ServiceName -n $Namespace -o jsonpath='{.spec.ports[0].port}'
    
    # Port forward for health check
    Write-Info "Setting up port forward for health check..."
    $portForwardJob = Start-Job -ScriptBlock {
        param($ServiceName, $Namespace, $ServicePort)
        kubectl port-forward service/$ServiceName -n $Namespace "8080:$ServicePort"
    } -ArgumentList $ServiceName, $Namespace, $servicePort
    
    # Wait a moment for port forward to establish
    Start-Sleep -Seconds 5
    
    # Health check
    $healthCheckPassed = $false
    for ($i = 1; $i -le 10; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8080/api/health/ready" -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                $healthCheckPassed = $true
                break
            }
        }
        catch {
            Write-Info "Health check attempt $i/10 failed, retrying in 5 seconds..."
            Start-Sleep -Seconds 5
        }
    }
    
    # Clean up port forward
    Stop-Job $portForwardJob -ErrorAction SilentlyContinue
    Remove-Job $portForwardJob -ErrorAction SilentlyContinue
    
    if ($healthCheckPassed) {
        Write-Success "Service health check passed"
    }
    else {
        Write-Error "Service health check failed"
        throw "Health check failed"
    }
}

# Show deployment status
function Show-Status {
    Write-Info "Deployment Status:"
    Write-Host "===================="
    
    # Deployment status
    kubectl get deployment $DeploymentName -n $Namespace -o wide
    Write-Host ""
    
    # Pod status
    Write-Info "Pods:"
    kubectl get pods -n $Namespace -l app=$ServiceName -o wide
    Write-Host ""
    
    # Service status
    Write-Info "Services:"
    kubectl get service $ServiceName -n $Namespace -o wide
    Write-Host ""
    
    # HPA status
    Write-Info "HPA Status:"
    kubectl get hpa -n $Namespace -l app=$ServiceName
    Write-Host ""
    
    # Recent events
    Write-Info "Recent Events:"
    kubectl get events -n $Namespace --field-selector involvedObject.name=$DeploymentName --sort-by='.lastTimestamp' | Select-Object -Last 5
}

# Main execution
function Main {
    try {
        Write-Info "Starting User Service Kubernetes deployment..."
        
        # Change to script directory
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        Set-Location (Join-Path $scriptDir "..")
        
        # Pre-deployment checks
        if (-not (Test-Kubectl)) {
            throw "kubectl check failed"
        }
        
        Ensure-Namespace
        
        # Deploy
        Apply-Manifests
        Wait-ForDeployment
        Test-ServiceHealth
        
        # Show final status
        Show-Status
        
        Write-Success "User Service deployment completed successfully!"
        Write-Info "Service is available at: http://$ServiceName.$Namespace.svc.cluster.local:3002"
        Write-Info "Health check: http://$ServiceName.$Namespace.svc.cluster.local:3002/api/health"
        Write-Info "Metrics: http://$ServiceName.$Namespace.svc.cluster.local:3002/api/metrics"
    }
    catch {
        Write-Error "Deployment failed: $($_.Exception.Message)"
        exit 1
    }
}

# Run main function
Main