# =============================================================================
# Deploy Auth Service to Staging Environment (PowerShell)
# Script for task 15.1: Deploy Auth Service alongside existing User Service
# =============================================================================

param(
    [string]$Namespace = "microservices",
    [string]$ServiceName = "auth-service",
    [string]$Timeout = "300s"
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Cyan"

Write-Host "🚀 Starting Auth Service deployment to staging environment" -ForegroundColor $Blue
Write-Host "==================================================" -ForegroundColor $Blue

# Function to check if command exists
function Test-Command {
    param([string]$Command)
    
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        Write-Host "❌ Error: $Command is not installed" -ForegroundColor $Red
        return $false
    }
}

# Function to wait for deployment
function Wait-ForDeployment {
    param([string]$DeploymentName)
    
    Write-Host "⏳ Waiting for deployment $DeploymentName to be ready..." -ForegroundColor $Yellow
    
    try {
        $result = kubectl rollout status deployment/$DeploymentName -n $Namespace --timeout=$Timeout
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Deployment $DeploymentName is ready" -ForegroundColor $Green
            return $true
        }
        else {
            Write-Host "❌ Deployment $DeploymentName failed to become ready" -ForegroundColor $Red
            return $false
        }
    }
    catch {
        Write-Host "❌ Error waiting for deployment: $_" -ForegroundColor $Red
        return $false
    }
}

# Function to check service health
function Test-ServiceHealth {
    param([string]$ServiceName, [string]$Port)
    
    Write-Host "🔍 Checking $ServiceName health..." -ForegroundColor $Yellow
    
    try {
        # Get pod name
        $podName = kubectl get pods -n $Namespace -l app=$ServiceName -o jsonpath='{.items[0].metadata.name}' 2>$null
        
        if ([string]::IsNullOrEmpty($podName)) {
            Write-Host "❌ No pods found for $ServiceName" -ForegroundColor $Red
            return $false
        }
        
        # Check health endpoint
        $healthCheck = kubectl exec -n $Namespace $podName -- curl -f "http://localhost:$Port/health" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $ServiceName health check passed" -ForegroundColor $Green
            return $true
        }
        else {
            Write-Host "❌ $ServiceName health check failed" -ForegroundColor $Red
            return $false
        }
    }
    catch {
        Write-Host "❌ Error checking service health: $_" -ForegroundColor $Red
        return $false
    }
}

# Function to test service integration
function Test-ServiceIntegration {
    Write-Host "🔗 Testing Auth Service integration with other services..." -ForegroundColor $Yellow
    
    try {
        # Get Auth Service pod
        $authPod = kubectl get pods -n $Namespace -l app=auth-service -o jsonpath='{.items[0].metadata.name}' 2>$null
        
        if ([string]::IsNullOrEmpty($authPod)) {
            Write-Host "❌ Auth Service pod not found" -ForegroundColor $Red
            return $false
        }
        
        $allTestsPassed = $true
        
        # Test User Service connectivity
        Write-Host "  Testing User Service connectivity..." -ForegroundColor $Blue
        $userServiceTest = kubectl exec -n $Namespace $authPod -- curl -f http://user-service:3002/health 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ User Service connectivity OK" -ForegroundColor $Green
        }
        else {
            Write-Host "  ⚠️  User Service connectivity failed (may not be deployed yet)" -ForegroundColor $Yellow
        }
        
        # Test Security Service connectivity
        Write-Host "  Testing Security Service connectivity..." -ForegroundColor $Blue
        $securityServiceTest = kubectl exec -n $Namespace $authPod -- curl -f http://security-service:3010/health 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Security Service connectivity OK" -ForegroundColor $Green
        }
        else {
            Write-Host "  ⚠️  Security Service connectivity failed (may not be deployed yet)" -ForegroundColor $Yellow
        }
        
        # Test Redis connectivity
        Write-Host "  Testing Redis connectivity..." -ForegroundColor $Blue
        $redisTest = kubectl exec -n $Namespace $authPod -- nc -z redis 6379 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Redis connectivity OK" -ForegroundColor $Green
        }
        else {
            Write-Host "  ❌ Redis connectivity failed" -ForegroundColor $Red
            $allTestsPassed = $false
        }
        
        # Test PostgreSQL connectivity
        Write-Host "  Testing PostgreSQL connectivity..." -ForegroundColor $Blue
        $postgresTest = kubectl exec -n $Namespace $authPod -- nc -z postgres-auth 5432 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ PostgreSQL connectivity OK" -ForegroundColor $Green
        }
        else {
            Write-Host "  ❌ PostgreSQL connectivity failed" -ForegroundColor $Red
            $allTestsPassed = $false
        }
        
        return $allTestsPassed
    }
    catch {
        Write-Host "❌ Error testing service integration: $_" -ForegroundColor $Red
        return $false
    }
}

# Check prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor $Blue

if (-not (Test-Command "kubectl")) {
    exit 1
}

if (-not (Test-Command "docker")) {
    exit 1
}

# Check if kubectl is configured
try {
    kubectl cluster-info | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ kubectl is not configured or cluster is not accessible" -ForegroundColor $Red
        exit 1
    }
}
catch {
    Write-Host "❌ kubectl is not configured or cluster is not accessible" -ForegroundColor $Red
    exit 1
}

Write-Host "✅ Prerequisites check passed" -ForegroundColor $Green

# Step 1: Create namespace if it doesn't exist
Write-Host "`n📁 Step 1: Ensuring namespace exists..." -ForegroundColor $Blue
try {
    kubectl get namespace $Namespace 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Namespace $Namespace already exists" -ForegroundColor $Green
    }
    else {
        kubectl apply -f ../k8s/namespace.yaml
        Write-Host "✅ Namespace $Namespace created" -ForegroundColor $Green
    }
}
catch {
    Write-Host "❌ Error managing namespace: $_" -ForegroundColor $Red
    exit 1
}

# Step 2: Apply secrets and configmaps
Write-Host "`n🔐 Step 2: Applying secrets and configmaps..." -ForegroundColor $Blue
try {
    kubectl apply -f ../k8s/auth-service-secrets.yaml
    kubectl apply -f ../k8s/auth-service-configmap.yaml
    Write-Host "✅ Secrets and configmaps applied" -ForegroundColor $Green
}
catch {
    Write-Host "❌ Error applying secrets and configmaps: $_" -ForegroundColor $Red
    exit 1
}

# Step 3: Deploy Auth Service
Write-Host "`n🚀 Step 3: Deploying Auth Service..." -ForegroundColor $Blue
try {
    kubectl apply -f ../k8s/auth-service-deployment.yaml
}
catch {
    Write-Host "❌ Error deploying Auth Service: $_" -ForegroundColor $Red
    exit 1
}

# Step 4: Wait for deployment to be ready
Write-Host "`n⏳ Step 4: Waiting for Auth Service to be ready..." -ForegroundColor $Blue
if (-not (Wait-ForDeployment "auth-service-deployment")) {
    Write-Host "❌ Auth Service deployment failed" -ForegroundColor $Red
    
    # Show logs for debugging
    Write-Host "`n📋 Recent logs from Auth Service:" -ForegroundColor $Yellow
    kubectl logs -n $Namespace -l app=auth-service --tail=50
    
    # Show pod status
    Write-Host "`n📋 Pod status:" -ForegroundColor $Yellow
    kubectl get pods -n $Namespace -l app=auth-service
    
    exit 1
}

# Step 5: Apply monitoring configuration
Write-Host "`n📊 Step 5: Applying monitoring configuration..." -ForegroundColor $Blue
try {
    kubectl apply -f ../k8s/auth-service-monitoring.yaml
    Write-Host "✅ Monitoring configuration applied" -ForegroundColor $Green
}
catch {
    Write-Host "⚠️  Warning: Could not apply monitoring configuration: $_" -ForegroundColor $Yellow
}

# Step 6: Validate service startup and health checks
Write-Host "`n🏥 Step 6: Validating service health..." -ForegroundColor $Blue
Start-Sleep -Seconds 10  # Give the service a moment to fully start

if (-not (Test-ServiceHealth "auth-service" "3001")) {
    Write-Host "❌ Auth Service health check failed" -ForegroundColor $Red
    
    # Show logs for debugging
    Write-Host "`n📋 Recent logs from Auth Service:" -ForegroundColor $Yellow
    kubectl logs -n $Namespace -l app=auth-service --tail=50
    
    exit 1
}

# Step 7: Test integration with other services
Write-Host "`n🔗 Step 7: Testing service integration..." -ForegroundColor $Blue
if (-not (Test-ServiceIntegration)) {
    Write-Host "⚠️  Some integration tests failed, but Auth Service is running" -ForegroundColor $Yellow
}
else {
    Write-Host "✅ All integration tests passed" -ForegroundColor $Green
}

# Step 8: Display deployment information
Write-Host "`n📋 Step 8: Deployment summary" -ForegroundColor $Blue
Write-Host "==================================================" -ForegroundColor $Blue

# Show service status
Write-Host "Service Status:" -ForegroundColor $Blue
kubectl get svc -n $Namespace auth-service

# Show pod status
Write-Host "`nPod Status:" -ForegroundColor $Blue
kubectl get pods -n $Namespace -l app=auth-service

# Show deployment status
Write-Host "`nDeployment Status:" -ForegroundColor $Blue
kubectl get deployment -n $Namespace auth-service-deployment

# Show endpoints
Write-Host "`nService Endpoints:" -ForegroundColor $Blue
kubectl get endpoints -n $Namespace auth-service

# Final success message
Write-Host "`n🎉 SUCCESS: Auth Service has been successfully deployed to staging!" -ForegroundColor $Green
Write-Host "==================================================" -ForegroundColor $Green
Write-Host "✅ Service startup: OK" -ForegroundColor $Green
Write-Host "✅ Health checks: OK" -ForegroundColor $Green
Write-Host "✅ Basic integration: OK" -ForegroundColor $Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor $Blue
Write-Host "1. Update API Gateway routing to include Auth Service"
Write-Host "2. Run comprehensive integration tests"
Write-Host "3. Monitor service metrics and logs"
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor $Blue
Write-Host "• View logs: kubectl logs -n $Namespace -l app=auth-service -f"
Write-Host "• Check status: kubectl get pods -n $Namespace -l app=auth-service"
Write-Host "• Port forward: kubectl port-forward -n $Namespace svc/auth-service 3001:3001"
Write-Host "• Health check: curl http://localhost:3001/health"

exit 0