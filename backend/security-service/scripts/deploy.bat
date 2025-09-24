@echo off
setlocal enabledelayedexpansion

REM Security Service Deployment Script for Windows
REM This script provides easy deployment options for different environments

set "ENVIRONMENT=development"
set "NAMESPACE=default"
set "REGISTRY=your-registry"
set "TAG=latest"
set "HELM_RELEASE=security-service"
set "COMMAND="

REM Parse command line arguments
:parse_args
if "%~1"=="" goto :check_command
if "%~1"=="-e" (
    set "ENVIRONMENT=%~2"
    shift
    shift
    goto :parse_args
)
if "%~1"=="--environment" (
    set "ENVIRONMENT=%~2"
    shift
    shift
    goto :parse_args
)
if "%~1"=="-n" (
    set "NAMESPACE=%~2"
    shift
    shift
    goto :parse_args
)
if "%~1"=="--namespace" (
    set "NAMESPACE=%~2"
    shift
    shift
    goto :parse_args
)
if "%~1"=="-r" (
    set "REGISTRY=%~2"
    shift
    shift
    goto :parse_args
)
if "%~1"=="--registry" (
    set "REGISTRY=%~2"
    shift
    shift
    goto :parse_args
)
if "%~1"=="-t" (
    set "TAG=%~2"
    shift
    shift
    goto :parse_args
)
if "%~1"=="--tag" (
    set "TAG=%~2"
    shift
    shift
    goto :parse_args
)
if "%~1"=="-h" goto :show_usage
if "%~1"=="--help" goto :show_usage
if "%~1"=="docker" (
    set "COMMAND=docker"
    shift
    goto :parse_args
)
if "%~1"=="k8s" (
    set "COMMAND=k8s"
    shift
    goto :parse_args
)
if "%~1"=="helm" (
    set "COMMAND=helm"
    shift
    goto :parse_args
)
if "%~1"=="build" (
    set "COMMAND=build"
    shift
    goto :parse_args
)
if "%~1"=="test" (
    set "COMMAND=test"
    shift
    goto :parse_args
)
if "%~1"=="clean" (
    set "COMMAND=clean"
    shift
    goto :parse_args
)
echo [ERROR] Unknown option: %~1
goto :show_usage

:check_command
if "%COMMAND%"=="" (
    echo [ERROR] No command specified
    goto :show_usage
)

REM Validate environment
if not "%ENVIRONMENT%"=="development" if not "%ENVIRONMENT%"=="staging" if not "%ENVIRONMENT%"=="production" (
    echo [ERROR] Invalid environment: %ENVIRONMENT%
    echo [ERROR] Valid environments: development, staging, production
    exit /b 1
)

echo [INFO] Security Service Deployment
echo [INFO] Environment: %ENVIRONMENT%
echo [INFO] Namespace: %NAMESPACE%
echo [INFO] Registry: %REGISTRY%
echo [INFO] Tag: %TAG%
echo [INFO] Command: %COMMAND%
echo.

if "%COMMAND%"=="build" goto :build_image
if "%COMMAND%"=="docker" goto :run_docker
if "%COMMAND%"=="k8s" goto :deploy_k8s
if "%COMMAND%"=="helm" goto :deploy_helm
if "%COMMAND%"=="test" goto :run_tests
if "%COMMAND%"=="clean" goto :cleanup

echo [ERROR] Unknown command: %COMMAND%
goto :show_usage

:build_image
echo [INFO] Building Docker image...
docker build -t "%REGISTRY%/security-service:%TAG%" .
if errorlevel 1 (
    echo [ERROR] Failed to build Docker image
    exit /b 1
)
echo [SUCCESS] Docker image built successfully
goto :end

:run_docker
echo [INFO] Starting Security Service with Docker Compose...
if not exist .env (
    echo [WARNING] .env file not found, copying from .env.example
    copy .env.example .env
)
docker-compose up --build -d
if errorlevel 1 (
    echo [ERROR] Failed to start Docker Compose services
    exit /b 1
)
echo [SUCCESS] Security Service started successfully
echo [INFO] Services running:
docker-compose ps
echo [INFO] Logs can be viewed with: docker-compose logs -f
echo [INFO] Stop services with: docker-compose down
goto :end

:deploy_k8s
echo [INFO] Deploying to Kubernetes with kubectl...
call :build_image
kubectl create namespace %NAMESPACE% --dry-run=client -o yaml | kubectl apply -f -
echo [INFO] Applying Kubernetes manifests...
kubectl apply -f k8s/ -n %NAMESPACE%
if errorlevel 1 (
    echo [ERROR] Failed to apply Kubernetes manifests
    exit /b 1
)
echo [INFO] Waiting for deployment to be ready...
kubectl rollout status deployment/security-service -n %NAMESPACE% --timeout=300s
echo [SUCCESS] Deployment completed successfully
kubectl get pods -n %NAMESPACE% -l app=security-service
goto :end

:deploy_helm
echo [INFO] Deploying with Helm...
call :build_image
kubectl create namespace %NAMESPACE% --dry-run=client -o yaml | kubectl apply -f -
set "VALUES_FILE=helm\security-service\values-%ENVIRONMENT%.yaml"
if not exist "%VALUES_FILE%" (
    set "VALUES_FILE=helm\security-service\values.yaml"
    echo [WARNING] Environment-specific values file not found, using default values.yaml
)
helm upgrade --install %HELM_RELEASE% helm\security-service --namespace %NAMESPACE% --values "%VALUES_FILE%" --set image.repository="%REGISTRY%/security-service" --set image.tag="%TAG%" --wait --timeout=10m
if errorlevel 1 (
    echo [ERROR] Failed to deploy with Helm
    exit /b 1
)
echo [SUCCESS] Helm deployment completed successfully
helm status %HELM_RELEASE% -n %NAMESPACE%
goto :end

:run_tests
echo [INFO] Running tests in Docker...
docker build -t security-service-test --target dependencies .
docker run --rm -v "%cd%:/usr/src/app" -w /usr/src/app security-service-test npm test
if errorlevel 1 (
    echo [ERROR] Tests failed
    exit /b 1
)
echo [SUCCESS] Tests completed successfully
goto :end

:cleanup
echo [INFO] Cleaning up resources...
if "%ENVIRONMENT%"=="development" (
    echo [INFO] Stopping Docker Compose services...
    docker-compose down -v
    docker system prune -f
) else (
    echo [INFO] Cleaning up Kubernetes resources...
    helm uninstall %HELM_RELEASE% -n %NAMESPACE% 2>nul
    kubectl delete -f k8s/ -n %NAMESPACE% 2>nul
)
echo [SUCCESS] Cleanup completed
goto :end

:show_usage
echo Usage: %~nx0 [OPTIONS] COMMAND
echo.
echo Options:
echo   -e, --environment    Environment (development^|staging^|production) [default: development]
echo   -n, --namespace      Kubernetes namespace [default: default]
echo   -r, --registry       Docker registry [default: your-registry]
echo   -t, --tag           Docker image tag [default: latest]
echo   -h, --help          Show this help message
echo.
echo Commands:
echo   docker              Build and run with Docker Compose
echo   k8s                 Deploy to Kubernetes using kubectl
echo   helm                Deploy using Helm chart
echo   build               Build Docker image only
echo   test                Run tests in Docker
echo   clean               Clean up resources
echo.
echo Examples:
echo   %~nx0 docker                                    # Run with Docker Compose
echo   %~nx0 helm -e production -n security-prod      # Deploy to production with Helm
echo   %~nx0 k8s -e staging -n security-staging       # Deploy to staging with kubectl
exit /b 0

:end
echo [SUCCESS] Operation completed successfully!
exit /b 0