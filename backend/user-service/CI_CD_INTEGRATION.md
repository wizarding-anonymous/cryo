# User Service CI/CD Integration

This document describes the CI/CD integration for the User Service after the refactoring to work with the shared infrastructure and microservices architecture.

## Overview

The User Service now has a dedicated CI/CD pipeline that:
- Tests with shared PostgreSQL and Redis services
- Integrates with the common docker-compose infrastructure
- Supports automatic deployment to staging and production
- Includes comprehensive security scanning and quality checks

## GitHub Actions Workflow

### Workflow File: `.github/workflows/user-service-quick-test.yml`

The workflow is triggered by:
- Push to `main` or `develop` branches
- Pull requests to `main`
- Changes to User Service code, docker-compose.yml, or shared components
- Manual dispatch

### Jobs Overview

#### 1. Test Job
- **Duration**: ~15 minutes
- **Services**: PostgreSQL (user_db), Redis with password
- **Steps**:
  - Unit tests with shared service configuration
  - Integration tests (if available)
  - Application build
  - Docker build test

#### 2. Docker Compose Test Job
- **Duration**: ~20 minutes
- **Purpose**: Test User Service with actual shared infrastructure
- **Steps**:
  - Start User Service with dependencies using `docker-compose.user-only.yml`
  - Health checks for all services
  - Smoke tests for basic functionality
  - Inter-service communication tests
  - Cleanup

#### 3. Security Job
- **Duration**: ~10 minutes
- **Tools**: Trivy vulnerability scanner
- **Scans**: File system and Docker image security

#### 4. Build Job
- **Condition**: Only if tests pass
- **Output**: Docker image pushed to GitHub Container Registry
- **Tags**: Branch-based and SHA-based tags

#### 5. Deploy Jobs
- **Staging**: Deploys on `develop` branch
- **Production**: Deploys on `main` branch
- **Uses**: Kubernetes with kubectl

## Docker Compose Configuration

### File: `backend/docker-compose.user-only.yml`

This file contains only User Service and its direct dependencies:
- **user-service**: The main service
- **postgres-user**: PostgreSQL database
- **redis**: Shared Redis cache

### Environment Variables

The workflow uses environment variables that match the main docker-compose.yml:
```bash
# Database
DB_HOST=postgres-user
DB_USER=user_service
DB_PASSWORD=user_password
DB_NAME=user_db

# Redis
REDIS_HOST=redis
REDIS_PASSWORD=redis_password

# Service
USER_SERVICE_PORT=3002
NODE_ENV=test
```

## Package.json Scripts

New scripts added for CI/CD integration:

### CI Scripts
```bash
npm run ci:test              # Run tests optimized for CI
npm run ci:test:integration  # Run integration tests
npm run ci:build            # Build application
npm run ci:docker:build     # Build Docker image
npm run ci:docker:test      # Test with Docker Compose
```

### Docker Test Scripts
```bash
npm run docker:test:up      # Start test environment
npm run docker:test:down    # Stop and cleanup test environment
npm run docker:test:logs    # View User Service logs
npm run docker:test:build   # Build test images
npm run docker:test:restart # Restart User Service
```

### Development Scripts
```bash
npm run dev:setup          # Setup development environment
npm run dev:teardown       # Cleanup development environment
```

## Development Setup

### Automated Setup (Recommended)

**Linux/macOS:**
```bash
cd backend/user-service
./scripts/dev-setup.sh
```

**Windows:**
```powershell
cd backend/user-service
.\scripts\dev-setup.ps1
```

### Manual Setup

1. **Install dependencies:**
   ```bash
   npm ci --legacy-peer-deps
   ```

2. **Start services:**
   ```bash
   npm run docker:test:up
   ```

3. **Wait for services to be ready:**
   ```bash
   # Check health
   curl http://localhost:3002/health
   ```

4. **Run migrations:**
   ```bash
   npm run migration:run
   ```

## Testing

### Local Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:e2e

# CI-optimized tests
npm run ci:test

# Docker Compose integration test
npm run ci:docker:test
```

### CI Testing

The CI pipeline runs:
1. **Linting**: ESLint with TypeScript rules
2. **Unit Tests**: Jest with PostgreSQL and Redis
3. **Integration Tests**: E2E tests if available
4. **Docker Build**: Validates Dockerfile
5. **Docker Compose**: Full integration test
6. **Security Scan**: Trivy vulnerability scanning

## Monitoring and Health Checks

### Health Endpoints

- **Health**: `GET /health` - Basic health check
- **Ready**: `GET /health/ready` - Kubernetes readiness probe
- **Live**: `GET /health/live` - Kubernetes liveness probe
- **Metrics**: `GET /metrics` - Prometheus metrics

### Service Dependencies

The health checks verify:
- PostgreSQL connection
- Redis connection
- Memory usage
- Disk space

## Deployment

### Staging Deployment

- **Trigger**: Push to `develop` branch
- **Environment**: `staging`
- **Process**: Kubernetes deployment with kubectl
- **Verification**: Health checks and smoke tests

### Production Deployment

- **Trigger**: Push to `main` branch
- **Environment**: `production`
- **Process**: Kubernetes deployment with kubectl
- **Verification**: Health checks and production smoke tests

### Rollback

If deployment fails:
1. Check GitHub Actions logs
2. Verify Kubernetes deployment status
3. Use kubectl to rollback if needed:
   ```bash
   kubectl rollout undo deployment/user-service-deployment -n microservices
   ```

## Security

### Vulnerability Scanning

- **Trivy**: Scans filesystem and Docker images
- **Results**: Uploaded to GitHub Security tab
- **Blocking**: Deployment blocked on high-severity vulnerabilities

### Secrets Management

Required secrets in GitHub repository:
- `GITHUB_TOKEN`: Automatic token for registry access
- `KUBE_CONFIG_STAGING`: Kubernetes config for staging
- `KUBE_CONFIG_PRODUCTION`: Kubernetes config for production
- `SLACK_WEBHOOK`: Optional Slack notifications

## Troubleshooting

### Common Issues

1. **Tests failing locally but passing in CI**
   - Check environment variables
   - Verify Docker services are running
   - Check port conflicts

2. **Docker Compose not starting**
   - Verify Docker is running
   - Check for port conflicts (5433, 6379, 3002)
   - Review docker-compose logs

3. **Health checks failing**
   - Wait longer for services to start
   - Check database migrations
   - Verify Redis password configuration

4. **Deployment failing**
   - Check Kubernetes cluster status
   - Verify secrets are configured
   - Review deployment logs

### Debug Commands

```bash
# Check service status
docker-compose -f docker-compose.user-only.yml ps

# View logs
docker-compose -f docker-compose.user-only.yml logs user-service

# Test database connection
docker-compose -f docker-compose.user-only.yml exec postgres-user pg_isready -U user_service -d user_db

# Test Redis connection
docker-compose -f docker-compose.user-only.yml exec redis redis-cli -a redis_password ping

# Manual health check
curl -v http://localhost:3002/health
```

## Integration with Other Services

### Auth Service Integration

The CI/CD pipeline includes tests for inter-service communication:
- Auth Service can reach User Service
- User Service responds to internal API calls
- Shared Redis is accessible by both services

### Shared Infrastructure

The User Service integrates with:
- **PostgreSQL**: Dedicated user_db database
- **Redis**: Shared cache with password authentication
- **Monitoring**: Prometheus metrics and Grafana dashboards
- **Logging**: ELK stack integration

## Performance Considerations

### CI Optimization

- **Parallel Jobs**: Tests and security scans run in parallel
- **Docker Layer Caching**: BuildKit cache for faster builds
- **Selective Testing**: Only runs when User Service code changes
- **Timeout Limits**: Prevents hanging jobs

### Resource Limits

- **Test Timeout**: 15 minutes for test job
- **Docker Compose Timeout**: 20 minutes for integration tests
- **Memory**: Optimized for GitHub Actions runners
- **Cleanup**: Automatic cleanup prevents resource leaks

## Future Improvements

1. **Performance Testing**: Add load testing to CI pipeline
2. **Canary Deployments**: Implement gradual rollouts
3. **Multi-Environment**: Add more staging environments
4. **Monitoring Integration**: Enhanced monitoring during deployments
5. **Automated Rollback**: Automatic rollback on health check failures