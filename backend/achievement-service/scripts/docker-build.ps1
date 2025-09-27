# Docker Build Script for Achievement Service (PowerShell)
# Usage: .\scripts\docker-build.ps1 [Environment] [Tag]

param(
    [string]$Environment = "production",
    [string]$Tag = "latest",
    [string]$Registry = $env:DOCKER_REGISTRY
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Constants
$ImageName = "achievement-service"

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    } else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput Green "🐳 Building Achievement Service Docker Image"
Write-ColorOutput Yellow "Environment: $Environment"
Write-ColorOutput Yellow "Tag: $Tag"

# Validate environment
switch ($Environment.ToLower()) {
    { $_ -in @("development", "dev") } {
        $Dockerfile = "Dockerfile"
        $Target = "builder"
    }
    { $_ -in @("staging", "stage") } {
        $Dockerfile = "Dockerfile"
        $Target = "runner"
    }
    { $_ -in @("production", "prod") } {
        $Dockerfile = "Dockerfile"
        $Target = "runner"
    }
    default {
        Write-ColorOutput Red "❌ Invalid environment: $Environment"
        Write-Output "Valid environments: development, staging, production"
        exit 1
    }
}

# Build image
Write-ColorOutput Green "📦 Building Docker image..."
try {
    docker build `
        --file $Dockerfile `
        --target $Target `
        --tag "${ImageName}:${Tag}" `
        --tag "${ImageName}:${Environment}-${Tag}" `
        --build-arg NODE_ENV=$Environment `
        .
    
    if ($LASTEXITCODE -ne 0) {
        throw "Docker build failed"
    }
} catch {
    Write-ColorOutput Red "❌ Build failed: $_"
    exit 1
}

# Tag for registry if specified
if ($Registry) {
    Write-ColorOutput Green "🏷️  Tagging for registry: $Registry"
    docker tag "${ImageName}:${Tag}" "${Registry}/${ImageName}:${Tag}"
    docker tag "${ImageName}:${Tag}" "${Registry}/${ImageName}:${Environment}-${Tag}"
}

# Show image info
Write-ColorOutput Green "✅ Build completed successfully!"
Write-ColorOutput Yellow "Image size:"
docker images "${ImageName}:${Tag}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# Security scan (if trivy is available)
if (Get-Command trivy -ErrorAction SilentlyContinue) {
    Write-ColorOutput Green "🔍 Running security scan..."
    trivy image --severity HIGH,CRITICAL "${ImageName}:${Tag}"
}

Write-ColorOutput Green "🚀 Ready to deploy!"
Write-ColorOutput Yellow "To run: docker run -p 3003:3003 ${ImageName}:${Tag}"

if ($Registry) {
    Write-ColorOutput Yellow "To push: docker push ${Registry}/${ImageName}:${Tag}"
}