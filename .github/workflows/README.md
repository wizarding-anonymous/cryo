# CRYO Microservices CI/CD Workflows

This directory contains GitHub Actions workflows for the CRYO microservices platform.

## Workflows Overview

### 1. `ci-cd.yml` - Main CI/CD Pipeline
- **Triggers**: Push to main/develop, PRs to main
- **Purpose**: Full CI/CD pipeline with testing, building, and deployment
- **Services**: All microservices (Node.js and Go)
- **Features**:
  - Unit and integration tests
  - Security scanning with Trivy
  - Docker image building and pushing
  - Kubernetes deployment to staging/production
  - Slack notifications

### 2. `docker-compose-test.yml` - Docker Compose Integration Tests
- **Triggers**: Changes to Docker Compose files or User Service
- **Purpose**: Test services using Docker Compose from backend folder
- **Features**:
  - User Service integration testing
  - Full stack smoke tests (develop branch only)
  - Health check validation
  - Service connectivity tests

### 3. `user-service-quick-test.yml` - User Service Fast Feedback
- **Triggers**: Changes to User Service code
- **Purpose**: Quick validation of User Service changes
- **Features**:
  - Fast unit tests and linting
  - Docker build validation
  - Docker Compose integration test
  - Optimized for developer feedback

### 4. `auth-service-quick-test.yml` - Auth Service Fast Feedback
- **Triggers**: Changes to Auth Service code, PRs
- **Purpose**: Quick validation and testing of Auth Service changes
- **Features**:
  - Fast unit tests and linting
  - Integration tests with PostgreSQL and Redis
  - Docker build validation
  - Health check validation
  - Comprehensive test summary

### 5. `auth-service-security.yml` - Auth Service Security & Compliance
- **Triggers**: Push to main/develop, PRs, scheduled daily scans
- **Purpose**: Enhanced security testing for authentication service
- **Features**:
  - Static security analysis with Semgrep
  - Dependency vulnerability scanning
  - Secret scanning with TruffleHog and GitLeaks
  - Docker security scanning with Trivy and Grype
  - Authentication-specific security tests
  - Compliance checks for password policy, JWT, rate limiting
  - Security report generation

### 6. `build-only.yml` - Build Without Tests
- **Triggers**: Manual dispatch, specific file changes
- **Purpose**: Build and push Docker images without running tests
- **Use case**: Emergency deployments or when tests are known to be failing

### 7. `syntax-check.yml` - Code Syntax Validation
- **Triggers**: PRs to main/develop
- **Purpose**: Fast syntax and formatting checks
- **Features**:
  - TypeScript/JavaScript syntax validation
  - Go syntax validation
  - JSON validation (package.json)

## Service-Specific Notes

### Auth Service
- Has dedicated security-focused workflows
- Requires PostgreSQL and Redis dependencies
- Enhanced security testing and compliance checks
- Docker security scanning and validation
- Authentication-specific penetration testing
- Comprehensive health check validation

### User Service
- Uses Docker Compose from `backend/` directory
- Requires PostgreSQL and Redis dependencies
- Has dedicated quick test workflow for fast feedback
- Supports both standalone and integrated testing

### Docker Compose Integration
All workflows that test with Docker Compose:
1. Change to `backend/` directory
2. Use `docker-compose.user-only.yml` for User Service testing
3. Use `docker-compose.yml` for full stack testing
4. Include proper cleanup steps

## Environment Variables
Required secrets and environment variables:
- `GITHUB_TOKEN` - Automatic GitHub token
- `KUBE_CONFIG_STAGING` - Kubernetes config for staging
- `KUBE_CONFIG_PRODUCTION` - Kubernetes config for production
- `SLACK_WEBHOOK` - Slack webhook for notifications

## Best Practices
1. All workflows include timeout limits
2. Docker builds use BuildKit and layer caching
3. Tests run with proper database/Redis services
4. Cleanup steps ensure no resource leaks
5. Continue-on-error for non-critical steps
6. Proper working directory management for backend services