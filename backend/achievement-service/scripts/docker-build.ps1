# Docker Build Script for Achievement Service (PowerShell)

param(
    [string]$Tag = "latest",
    [string]$Environment = "production",
    [switch]$Push = $false,
    [switch]$Help = $false
)

# Show help
if ($Help) {
    Write-Host "Usage: .\docker-build.ps1 [OPTIONS]"
    Write-Host "Options:"
    Write-Host "  -Tag TAG           Docker image tag (default: latest)"
    Write-Host "  -Environment ENV   Environment (default: production)"
    Write-Host "  -Push              Push image to registry"
    Write-Host "  -Help              Show this help message"
    exit 0
}

$ImageName = "achievement-service"

Write-Host "Building Achievement Service Docker image..." -ForegroundColor Green
Write-Host "Image: $ImageName`:$Tag" -ForegroundColor Yellow
Write-Host "Environment: $Environment" -ForegroundColor Yellow

# Build the Docker image
Write-Host "Step 1: Building Docker image" -ForegroundColor Green
$buildArgs = @(
    "build",
    "--build-arg", "NODE_ENV=$Environment",
    "-t", "$ImageName`:$Tag",
    "-f", "Dockerfile",
    "."
)

$buildResult = Start-Process -FilePath "docker" -ArgumentList $buildArgs -Wait -PassThru -NoNewWindow

if ($buildResult.ExitCode -eq 0) {
    Write-Host "✓ Docker image built successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Docker build failed" -ForegroundColor Red
    exit 1
}

# Tag with environment
if ($Tag -ne $Environment) {
    Write-Host "Step 2: Tagging image for environment" -ForegroundColor Green
    docker tag "$ImageName`:$Tag" "$ImageName`:$Environment"
}

# Show image info
Write-Host "Step 3: Image information" -ForegroundColor Green
docker images $ImageName

# Push to registry if requested
if ($Push) {
    Write-Host "Step 4: Pushing to registry" -ForegroundColor Green
    docker push "$ImageName`:$Tag"
    if ($Tag -ne $Environment) {
        docker push "$ImageName`:$Environment"
    }
    Write-Host "✓ Image pushed to registry" -ForegroundColor Green
}

Write-Host "Build completed successfully!" -ForegroundColor Green
Write-Host "To run the container:" -ForegroundColor Yellow
Write-Host "docker run -p 3003:3003 --env-file .env.$Environment $ImageName`:$Tag"