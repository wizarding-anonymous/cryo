# Docker Setup for API Gateway

This document describes the Docker containerization setup for the API Gateway service.

## Overview

The API Gateway uses a multi-stage Docker build process optimized for production deployment with comprehensive development support through Docker Compose.

## Files Structure

```
backend/api-gateway/
├── Dockerfile                 # Multi-stage production-ready Dockerfile
├── .dockerignore             # Docker ignore patterns
├── docker-compose.yml        # Development environment
├── docker-compose.prod.yml   # Production environment
├── docker-dev.sh            # Development script (Linux/macOS)
├── docker-dev.ps1           # Development script (Windows)
├── redis.conf               # Redis configuration for development
├── redis.prod.conf          # Redis configuration for production
└── mocks/                   # Mock services for development
    ├── user-service/
    ├── game-catalog-service/
    ├── payment-service/
    ├── library-service/
    └── notification-service/
```

## Docker Image Features

### Multi-Stage Build
- **Stage 1**: Dependencies - Install all dependencies including dev dependencies
- **Stage 2**: Builder - Build the TypeScript application
- **Stage 3**: Production Dependencies - Install only production dependencies
- **Stage 4**: Production - Final optimized image with security hardening

### Security Features
- Non-root user (nestjs:nodejs)
- Minimal Alpine Linux base image
- Security-hardened Redis configuration
- Health checks for all services
- Resource limits and reservations

### Performance Optimizations
- Layer caching optimization
- Multi-stage build reduces final image size
- Production dependencies separated from build dependencies
- Optimized Redis configuration for caching

## Development Environment

### Quick Start

**Windows (PowerShell):**
```powershell
# Start all services
.\docker-dev.ps1 -Command start

# Check service health
.\docker-dev.ps1 -Command health

# View logs
.\docker-dev.ps1 -Command logs

# Stop services
.\docker-dev.ps1 -Command stop
```

**Linux/macOS (Bash):**
```bash
# Start all services
./docker-dev.sh start

# Check service health
./docker-dev.sh health

# View logs
./docker-dev.sh logs

# Stop services
./docker-dev.sh stop
```

### Manual Docker Compose

```bash
# Build and start development environment
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Clean up volumes
docker-compose down -v
```

### Development Services

The development environment includes:

- **API Gateway** (port 3001) - Main gateway service
- **Redis** (port 6379) - Caching and rate limiting
- **User Service Mock** (port 3000) - Authentication and user management
- **Game Catalog Service Mock** (port 3002) - Game catalog and search
- **Payment Service Mock** (port 3003) - Payment processing
- **Library Service Mock** (port 3004) - User game library
- **Notification Service Mock** (port 3005) - User notifications

### Health Checks

All services include health check endpoints:
- API Gateway: `http://localhost:3001/health`
- Mock Services: `http://localhost:<port>/health`
- Redis: Built-in Redis ping

## Production Environment

### Production Deployment

```bash
# Build and start production environment
docker-compose -f docker-compose.prod.yml up -d --build

# View production logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop production services
docker-compose -f docker-compose.prod.yml down
```

### Production Features

- **Resource Limits**: CPU and memory limits for containers
- **Security Hardening**: Non-root users, minimal attack surface
- **Optimized Redis**: Production-tuned Redis configuration
- **Logging**: Structured JSON logging with rotation
- **Health Monitoring**: Comprehensive health checks
- **Environment Variables**: Configurable service URLs and settings

### Environment Variables

Key production environment variables:

```bash
# Service URLs (override in deployment)
SERVICE_USER_BASE_URL=http://user-service:3000
SERVICE_GAME_CATALOG_BASE_URL=http://game-catalog-service:3002
SERVICE_PAYMENT_BASE_URL=http://payment-service:3003
# ... other service URLs

# Security
CORS_ORIGIN=https://cryo-gaming.ru
REDIS_PASSWORD=your-redis-password

# Performance
RATE_LIMIT_MAX_REQUESTS=1000
CACHE_TTL_MS=300000
```

## Mock Services

### Available Mock Services

1. **User Service** - Authentication, user profiles, JWT validation
2. **Game Catalog Service** - Game listings, search, details
3. **Payment Service** - Payment processing, transaction history
4. **Library Service** - User game library, downloads
5. **Notification Service** - User notifications, messaging

### Mock Service Endpoints

Each mock service provides realistic endpoints for development:

```bash
# User Service (port 3000)
POST /api/auth/login
POST /api/auth/register
GET  /api/users/profile
PUT  /api/users/profile
POST /api/auth/validate

# Game Catalog Service (port 3002)
GET  /api/games
GET  /api/games/:id
GET  /api/games/search

# Payment Service (port 3003)
GET  /api/payments
POST /api/payments
GET  /api/payments/:id

# Library Service (port 3004)
GET  /api/library
POST /api/library/:gameId
DELETE /api/library/:gameId

# Notification Service (port 3005)
GET  /api/notifications
POST /api/notifications
PUT  /api/notifications/:id/read
```

## Testing with Docker

### Running Tests in Container

```bash
# Run all tests
docker-compose exec api-gateway npm run test

# Run E2E tests
docker-compose exec api-gateway npm run test:e2e

# Run specific test suite
docker-compose exec api-gateway npm run test:security
```

### Performance Testing

```bash
# Run performance tests
docker-compose exec api-gateway npm run perf:load
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Ensure ports 3000-3005 and 6379 are available
2. **Docker Not Running**: Start Docker Desktop/daemon
3. **Build Failures**: Clear Docker cache with `docker system prune -f`
4. **Service Health**: Check logs with `docker-compose logs <service>`

### Debug Commands

```bash
# Check container status
docker-compose ps

# Inspect container
docker inspect api-gateway

# Execute shell in container
docker-compose exec api-gateway sh

# Check Redis connection
docker-compose exec redis redis-cli ping

# View container resource usage
docker stats
```

### Log Analysis

```bash
# Follow all logs
docker-compose logs -f

# Filter logs by service
docker-compose logs -f api-gateway

# View last 100 lines
docker-compose logs --tail=100 api-gateway
```

## Kubernetes Deployment

The Docker images are designed to be Kubernetes-ready:

- Health checks for liveness and readiness probes
- Graceful shutdown handling
- Environment variable configuration
- Resource limits and requests
- Security contexts with non-root users

See the `k8s/` directory for Kubernetes manifests.

## Security Considerations

### Production Security

- Use secrets management for sensitive environment variables
- Enable Redis authentication in production
- Configure proper CORS origins
- Use HTTPS termination at load balancer
- Regular security updates for base images
- Network policies for service-to-service communication

### Development Security

- Mock services should not be used in production
- Development Redis has no authentication (localhost only)
- CORS is permissive for development (`*` origin)
- Debug logging enabled in development

## Performance Tuning

### Docker Performance

- Use `.dockerignore` to reduce build context
- Multi-stage builds minimize final image size
- Layer caching optimization
- Resource limits prevent resource exhaustion

### Redis Performance

- Optimized Redis configuration for caching workloads
- Memory limits and eviction policies
- Persistence configuration for development vs production
- Connection pooling in application

## Monitoring and Observability

### Health Monitoring

All services include comprehensive health checks:
- Application health endpoints
- Database connectivity checks
- External service dependency checks
- Resource utilization monitoring

### Logging

- Structured JSON logging in production
- Log rotation and retention policies
- Centralized logging with Docker log drivers
- Debug logging in development environment

This Docker setup provides a complete development and production environment for the API Gateway with all necessary mock services and infrastructure components.