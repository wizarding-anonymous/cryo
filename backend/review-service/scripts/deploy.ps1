# Production deployment script for Review Service (PowerShell)
param(
    [string]$ImageTag = "latest",
    [string]$Registry = "your-registry.com",
    [switch]$RunLoadTest = $false
)

$ErrorActionPreference = "Stop"

# Configuration
$Namespace = "review-service"
$ImageName = "$Registry/review-service:$ImageTag"

# Colors for output
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check prerequisites
function Test-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    if (!(Get-Command kubectl -ErrorAction SilentlyContinue)) {
        Write-Error "kubectl is not installed"
        exit 1
    }
    
    if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Error "docker is not installed"
        exit 1
    }
    
    # Check if we can connect to Kubernetes cluster
    try {
        kubectl cluster-info | Out-Null
    }
    catch {
        Write-Error "Cannot connect to Kubernetes cluster"
        exit 1
    }
    
    Write-Info "Prerequisites check passed"
}

# Build and push Docker image
function Build-AndPush {
    Write-Info "Building Docker image: $ImageName"
    
    # Build optimized production image
    docker build -t $ImageName --target production .
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker build failed"
        exit 1
    }
    
    Write-Info "Pushing image to registry..."
    docker push $ImageName
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker push failed"
        exit 1
    }
    
    Write-Info "Image built and pushed successfully"
}

# Deploy to Kubernetes
function Deploy-ToK8s {
    Write-Info "Deploying to Kubernetes..."
    
    # Create namespace if it doesn't exist
    kubectl create namespace $Namespace --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply Kubernetes manifests
    Write-Info "Applying ConfigMap..."
    kubectl apply -f k8s/configmap.yaml
    
    Write-Info "Applying Secret..."
    kubectl apply -f k8s/secret.yaml
    
    Write-Info "Applying Service..."
    kubectl apply -f k8s/service.yaml
    
    # Update deployment with new image
    Write-Info "Updating deployment with image: $ImageName"
    kubectl set image deployment/review-service review-service=$ImageName -n $Namespace
    
    # Apply deployment (in case it doesn't exist)
    kubectl apply -f k8s/deployment.yaml
    
    # Apply HPA
    Write-Info "Applying HorizontalPodAutoscaler..."
    kubectl apply -f k8s/hpa.yaml
    
    # Apply ServiceMonitor if Prometheus is available
    try {
        kubectl get crd servicemonitors.monitoring.coreos.com | Out-Null
        Write-Info "Applying ServiceMonitor..."
        kubectl apply -f k8s/servicemonitor.yaml
    }
    catch {
        Write-Warn "ServiceMonitor CRD not found, skipping monitoring setup"
    }
}

# Wait for deployment to be ready
function Wait-ForDeployment {
    Write-Info "Waiting for deployment to be ready..."
    
    kubectl rollout status deployment/review-service -n $Namespace --timeout=300s
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Deployment failed to become ready"
        exit 1
    }
    
    Write-Info "Deployment is ready"
}

# Run health checks
function Test-Health {
    Write-Info "Running health checks..."
    
    # Port forward for health check (in background)
    $PortForwardJob = Start-Job -ScriptBlock {
        kubectl port-forward service/review-service 8080:3004 -n $using:Namespace
    }
    
    # Wait a moment for port forward to establish
    Start-Sleep -Seconds 5
    
    try {
        # Health check
        $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Info "Health check passed"
        } else {
            Write-Error "Health check failed"
            exit 1
        }
        
        # Detailed health check
        try {
            $detailedResponse = Invoke-WebRequest -Uri "http://localhost:8080/health/detailed" -UseBasicParsing -TimeoutSec 10
            if ($detailedResponse.StatusCode -eq 200) {
                Write-Info "Detailed health check passed"
            } else {
                Write-Warn "Detailed health check failed - some integrations may be unavailable"
            }
        }
        catch {
            Write-Warn "Detailed health check failed - some integrations may be unavailable"
        }
    }
    catch {
        Write-Error "Health check failed: $_"
        exit 1
    }
    finally {
        # Clean up port forward
        Stop-Job $PortForwardJob -ErrorAction SilentlyContinue
        Remove-Job $PortForwardJob -ErrorAction SilentlyContinue
    }
}

# Load testing
function Invoke-LoadTest {
    if ($RunLoadTest) {
        Write-Info "Running load test..."
        
        # Port forward for load testing
        $PortForwardJob = Start-Job -ScriptBlock {
            kubectl port-forward service/review-service 8080:3004 -n $using:Namespace
        }
        
        Start-Sleep -Seconds 5
        
        try {
            # Run load test
            Push-Location load-test
            $env:BASE_URL = "http://localhost:8080"
            k6 run load-test.js
            
            if ($LASTEXITCODE -eq 0) {
                Write-Info "Load test passed"
            } else {
                Write-Error "Load test failed"
                exit 1
            }
        }
        finally {
            Pop-Location
            Stop-Job $PortForwardJob -ErrorAction SilentlyContinue
            Remove-Job $PortForwardJob -ErrorAction SilentlyContinue
        }
    } else {
        Write-Info "Skipping load test (use -RunLoadTest to enable)"
    }
}

# Main deployment flow
function Main {
    Write-Info "Review Service Production Deployment"
    Write-Info "Image: $ImageName"
    Write-Info "Namespace: $Namespace"
    
    Test-Prerequisites
    Build-AndPush
    Deploy-ToK8s
    Wait-ForDeployment
    Test-Health
    Invoke-LoadTest
    
    Write-Info "🎉 Deployment completed successfully!"
    Write-Info "Service is available at: kubectl get service review-service -n $Namespace"
    Write-Info "Monitor with: kubectl logs -f deployment/review-service -n $Namespace"
}

# Run main function
Main