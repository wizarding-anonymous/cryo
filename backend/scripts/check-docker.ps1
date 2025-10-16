# Check Docker Status and Start if Needed
Write-Host "Checking Docker status..." -ForegroundColor Cyan

try {
    $dockerInfo = docker info 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Docker is running!" -ForegroundColor Green
        docker --version
        exit 0
    }
} catch {
    Write-Host "Docker is not running or not accessible" -ForegroundColor Yellow
}

Write-Host "Attempting to start Docker Desktop..." -ForegroundColor Yellow

# Try to start Docker Desktop
$dockerDesktopPath = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
if (Test-Path $dockerDesktopPath) {
    Write-Host "Starting Docker Desktop..." -ForegroundColor Yellow
    Start-Process -FilePath $dockerDesktopPath -WindowStyle Hidden
    
    # Wait for Docker to start
    $maxWait = 60
    $waited = 0
    
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 5
        $waited += 5
        
        try {
            docker info 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Docker is now running!" -ForegroundColor Green
                docker --version
                exit 0
            }
        } catch {
            # Continue waiting
        }
        
        Write-Host "Waiting for Docker to start... ($waited/$maxWait seconds)" -ForegroundColor Yellow
    }
    
    Write-Host "Docker failed to start within $maxWait seconds" -ForegroundColor Red
    exit 1
} else {
    Write-Host "Docker Desktop not found at: $dockerDesktopPath" -ForegroundColor Red
    Write-Host "Please install Docker Desktop or start it manually" -ForegroundColor Red
    exit 1
}