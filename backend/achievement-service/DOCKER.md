# Docker Configuration - Achievement Service

## Overview

This document describes the Docker containerization setup for the Achievement Service, including multi-stage builds, environment configurations, and deployment strategies.

## Architecture

### Multi-Stage Build

The Dockerfile uses a 3-stage build process:

1. **Base Stage**: Sets up Node.js environment and copies configuration files
2. **Dependencies Stage**: Installs production dependencies
3. **Builder Stage**: Builds the application
4. **Runner Stage**: Creates the final production image

### Benefits

- **Smaller Image Size**: Only production dependencies and built artifacts
- **Security**: Non-root user execution with minimal attack surface
- **Performance**: Optimized for production workloads
- **Reliability**: Health checks and proper signal handling

## Files Structure

```
├── Dockerfile                 # Multi-stage production build
├── docker-compose.yml         # Default development setup
├── docker-compose.dev.yml     # Development environment
├── docker-compose.prod.yml    # Production environment
├── .dockerignore             # Optimized ignore patterns
├── redis.conf                # Redis configuration
├── .env.development          # Development variables
├── .env.staging              # Staging variables
├── .env.production           # Production variables
└── scripts/
    ├── docker-build.sh       # Linux/macOS build script
    └── docker-build.ps1      # Windows PowerShell build script
```

## Environment Configurations

### Development

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Features:
- Hot reload with volume mounts
- Debug port exposed (9229)
- Separate dev database
- Verbose logging
- Development-friendly settings
```

### Staging

```bash
# Start staging environment
docker-compose -f docker-compose.yml up -d

# Features:
- Production-like configuration
- Environment variable substitution
- Resource limits
- Health checks
```

### Production

```bash
# Start production environment
docker-compose -f docker-compose.prod.yml up -d

# Features:
- Optimized resource allocation
- Security hardening
- Logging configuration
- High availability setup
- Monitoring integration
```

## Health Checks

### Application Health Endpoints

The service provides three health check endpoints for Kubernetes:

1. **General Health**: `GET /health`
   - Basic service availability
   - Used for Docker health checks

2. **Readiness Probe**: `GET /health/ready`
   - Database and Redis connectivity
   - Service dependencies status
   - Used for Kubernetes readiness probe

3. **Liveness Probe**: `GET /health/live`
   - Application responsiveness
   - Memory and CPU health
   - Used for Kubernetes liveness probe

### Docker Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3003/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1
```

## Environment Variables

### Required Variables (Production)

```bash
# Security
JWT_SECRET=your-secure-jwt-secret
DATABASE_PASSWORD=secure-database-password
REDIS_PASSWORD=secure-redis-password

# External Services
NOTIFICATION_SERVICE_URL=http://notification-service:3000
LIBRARY_SERVICE_URL=http://library-service:3000
PAYMENT_SERVICE_URL=http://payment-service:3000
REVIEW_SERVICE_URL=http://review-service:3000
SOCIAL_SERVICE_URL=http://social-service:3000

# Application
CORS_ORIGIN=https://your-domain.com
```

### Optional Variables

```bash
# Database
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=achievement_db
DATABASE_USER=achievement_user
DATABASE_SSL=true

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
REDIS_TTL=3600

# Application
PORT=3003
LOG_LEVEL=info
LOG_FORMAT=json
```

## Build Commands

### Using Build Scripts

```bash
# Linux/macOS
./scripts/docker-build.sh production latest

# Windows PowerShell
.\scripts\docker-build.ps1 -Environment production -Tag latest
```

### Manual Build

```bash
# Development build
docker build --target builder -t achievement-service:dev .

# Production build
docker build --target runner -t achievement-service:prod .

# With build args
docker build \
  --build-arg NODE_ENV=production \
  --target runner \
  -t achievement-service:latest .
```

## Deployment Commands

### Development

```bash
# Start development stack
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f achievement-service

# Stop stack
docker-compose -f docker-compose.dev.yml down
```

### Production

```bash
# Start production stack
docker-compose -f docker-compose.prod.yml up -d

# Scale service
docker-compose -f docker-compose.prod.yml up -d --scale achievement-service=3

# Update service
docker-compose -f docker-compose.prod.yml up -d --no-deps achievement-service

# Stop stack
docker-compose -f docker-compose.prod.yml down
```

## Resource Management

### Development Limits

```yaml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
    reservations:
      memory: 256M
      cpus: '0.25'
```

### Production Limits

```yaml
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '1.0'
    reservations:
      memory: 512M
      cpus: '0.5'
```

## Security Features

### Container Security

- **Non-root user**: Application runs as `nestjs` user (UID 1001)
- **Read-only filesystem**: Minimal write permissions
- **Security scanning**: Trivy integration for vulnerability detection
- **Minimal base image**: Alpine Linux for reduced attack surface

### Network Security

- **Custom networks**: Isolated container communication
- **Port exposure**: Only necessary ports exposed
- **Environment isolation**: Separate networks per environment

## Monitoring and Logging

### Logging Configuration

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### Metrics Endpoints

- **Prometheus metrics**: `/metrics`
- **Health status**: `/health`
- **Service monitoring**: `/monitoring/health/services`

## Troubleshooting

### Common Issues

1. **Build failures**
   ```bash
   # Clear Docker cache
   docker system prune -a
   
   # Rebuild without cache
   docker build --no-cache -t achievement-service:latest .
   ```

2. **Health check failures**
   ```bash
   # Check service logs
   docker logs achievement-service
   
   # Test health endpoint
   curl http://localhost:3003/health
   ```

3. **Database connection issues**
   ```bash
   # Check database status
   docker-compose ps postgres
   
   # Check database logs
   docker-compose logs postgres
   ```

### Performance Optimization

1. **Image size optimization**
   - Multi-stage builds
   - Optimized .dockerignore
   - Alpine base images
   - Dependency pruning

2. **Runtime optimization**
   - Memory limits
   - CPU limits
   - Health check intervals
   - Restart policies

## Best Practices

### Development

- Use volume mounts for hot reload
- Separate development database
- Enable debug logging
- Use development-specific environment variables

### Production

- Use specific image tags (not `latest`)
- Set resource limits
- Configure health checks
- Use secrets management
- Enable monitoring and logging
- Implement backup strategies

### Security

- Regular security scans
- Non-root user execution
- Minimal base images
- Environment variable validation
- Network segmentation
- Regular updates

## Integration with Kubernetes

The Docker configuration is designed to work seamlessly with Kubernetes:

- **Health checks** map to readiness/liveness probes
- **Environment variables** support ConfigMaps and Secrets
- **Resource limits** align with Kubernetes resource management
- **Logging** integrates with Kubernetes logging infrastructure

### Example Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: achievement-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: achievement-service
  template:
    metadata:
      labels:
        app: achievement-service
    spec:
      containers:
      - name: achievement-service
        image: achievement-service:latest
        ports:
        - containerPort: 3003
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          limits:
            memory: "1Gi"
            cpu: "1000m"
          requests:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3003
          initialDelaySeconds: 60
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3003
          initialDelaySeconds: 30
          periodSeconds: 10
```