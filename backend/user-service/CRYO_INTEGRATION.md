# User Service Integration with Cryo Project

## Overview
User Service has been fully integrated into the Cryo microservices architecture. This document outlines the integration changes and how the service fits into the overall system.

## Integration Status ✅

### 1. Docker Compose Integration
- ✅ **Main Compose File**: User service is included in `backend/docker-compose.yml`
- ✅ **Production Compose**: Configured in `backend/docker-compose.prod.yml` with resource limits
- ✅ **Shared Infrastructure**: Uses shared Redis and dedicated PostgreSQL database
- ✅ **Network Integration**: Connected to `microservices-network`
- ✅ **Environment Configuration**: Uses `.env.docker` for Docker-specific settings

### 2. Kubernetes Integration
- ✅ **Namespace Alignment**: Migrated from `gaming-platform` to `microservices` namespace
- ✅ **Common Resources**: Uses shared `microservices-config` ConfigMap and `microservices-secrets` Secret
- ✅ **Deployment Files**: Created `backend/k8s/user-service-deployment.yaml` in common k8s folder
- ✅ **Service Discovery**: Properly configured in ingress and service mesh
- ✅ **Monitoring**: ServiceMonitor configured for Prometheus scraping
- ✅ **Auto-scaling**: HPA configured for production workloads

### 3. CI/CD Integration
- ✅ **GitHub Actions**: Included in main CI/CD pipeline at `.github/workflows/microservices-ci-cd.yml`
- ✅ **Smart Deployment**: Only deploys when user-service files are changed
- ✅ **Multi-Environment**: Supports staging and production deployments
- ✅ **Security Scanning**: Integrated with Trivy vulnerability scanner
- ✅ **Container Registry**: Uses GitHub Container Registry (ghcr.io)

### 4. Infrastructure Integration
- ✅ **Makefile Commands**: Included in all backend management commands
- ✅ **Health Checks**: Integrated into system-wide health monitoring
- ✅ **Logging**: Connected to ELK stack for centralized logging
- ✅ **Metrics**: Prometheus metrics collection configured

## Service Endpoints

### Internal Service Communication
- **Service Name**: `user-service`
- **Port**: `3001`
- **Health Check**: `/api/health`
- **Metrics**: `/metrics` (port 9090)

### External Access
- **API Gateway**: Routes through main API Gateway at `/api/users`
- **Direct Access**: Available at `/api/users` via ingress
- **Monitoring**: Accessible via monitoring ingress

## Database Configuration

### PostgreSQL
- **Database**: `user_db`
- **User**: `user_service`
- **Host**: Shared PostgreSQL service in cluster
- **Port**: `5432`
- **Connection**: Uses shared database server with dedicated database

### Redis
- **Host**: Shared Redis service
- **Port**: `6379`
- **Authentication**: Uses shared Redis password
- **Usage**: Session storage, caching, rate limiting

## Deployment Process

### Development
```bash
# Start all services including user-service
cd backend
make dev

# Or start just user-service
docker-compose up -d user-service
```

### Staging Deployment
- Triggered on push to `develop` branch
- Only deploys if user-service files changed
- Uses image tag: `develop-{commit-sha}`

### Production Deployment
- Triggered on push to `main` branch
- Deploys all services for consistency
- Uses image tag: `main-{commit-sha}`

## Contact
For questions about user-service integration, please contact the backend team or create an issue in the repository.