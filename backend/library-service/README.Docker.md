# Docker Setup for Library Service

This document describes the comprehensive Docker setup for the Library Service following unified platform standards.

## Quick Start

### Development Environment
```bash
# Full development stack with mock services
docker-compose up --build

# Development with external services (no mocks)
docker-compose -f docker-compose.dev.yml up --build

# Run tests with Docker
npm run test:e2e:docker
```

### Production Environment
```bash
# Build production image
docker build --target production -t library-service:prod .

# Run production stack
docker-compose -f docker-compose.prod.yml up -d

# Scale the service
docker-compose -f docker-compose.prod.yml up -d --scale library-service=3
```

## Architecture Overview

### Multi-Stage Dockerfile
- **Base**: Common dependencies and user setup
- **Development**: Hot reload, all dependencies
- **Builder**: Compilation stage
- **Production**: Optimized runtime image

### Service Stack
```
┌─────────────────┐    ┌─────────────────┐
│   Nginx LB      │    │  Library Service│
│   (Production)  │────│   (NestJS)      │
└─────────────────┘    └─────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼──────┐    ┌─────────▼──────┐    ┌─────────▼──────┐
│ PostgreSQL   │    │     Redis      │    │  Mock Services │
│   Database   │    │     Cache      │    │   (Dev Only)   │
└──────────────┘    └────────────────┘    └────────────────┘
```

## Services Configuration

### Library Service
- **Port**: 3000
- **Health Check**: `/health` endpoint
- **Metrics**: `/metrics` (Prometheus)
- **Security**: Non-root user, resource limits
- **Scaling**: Horizontal scaling ready

### PostgreSQL Database
- **Version**: 14-alpine
- **Port**: 5432
- **Features**: SSL, connection pooling, performance tuning
- **Persistence**: Named volumes with backup strategies

### Redis Cache
- **Version**: 7-alpine
- **Port**: 6379
- **Features**: Password protection, memory limits, persistence
- **Configuration**: Optimized for caching workloads

### Mock Services (Development)
- **Game Catalog Mock**: Port 3001 (MockServer)
- **User Service Mock**: Port 3002 (MockServer)
- **Payment Service Mock**: Port 3003 (MockServer)

### Nginx Load Balancer (Production)
- **Ports**: 80 (HTTP), 443 (HTTPS)
- **Features**: SSL termination, rate limiting, security headers
- **Load Balancing**: Least connections algorithm

## Environment Configuration

### Development (.env.development)
```env
NODE_ENV=development
DATABASE_HOST=postgres
DATABASE_SYNCHRONIZE=true
DATABASE_LOGGING=true
LOG_LEVEL=debug
PROMETHEUS_ENABLED=false
```

### Production (.env.production)
```env
NODE_ENV=production
DATABASE_SYNCHRONIZE=false
DATABASE_LOGGING=false
DATABASE_SSL=true
LOG_LEVEL=info
PROMETHEUS_ENABLED=true
APM_ENABLED=true
```

### Required Secrets (Production)
```bash
# Create secret files
echo "your-secure-db-password" > secrets/database_password.txt
echo "your-jwt-secret-32-chars-min" > secrets/jwt_secret.txt
echo "your-redis-password" > secrets/redis_password.txt
```

## Security Best Practices

### Container Security
- ✅ Non-root user execution (nestjs:1001)
- ✅ Multi-stage builds (minimal attack surface)
- ✅ Read-only root filesystem where possible
- ✅ Resource limits and quotas
- ✅ Health checks and monitoring
- ✅ Proper signal handling (dumb-init)

### Network Security
- ✅ Internal networks for service communication
- ✅ SSL/TLS encryption
- ✅ Rate limiting and DDoS protection
- ✅ Security headers (HSTS, CSP, etc.)
- ✅ Restricted access to metrics endpoints

### Data Security
- ✅ Docker secrets for sensitive data
- ✅ Database SSL connections
- ✅ Redis password authentication
- ✅ Encrypted data at rest
- ✅ Audit logging

## Performance Optimization

### Application Layer
```dockerfile
# Optimized Node.js settings
ENV NODE_OPTIONS="--max-old-space-size=512"
ENV UV_THREADPOOL_SIZE=4
```

### Database Layer
```sql
-- PostgreSQL optimization
shared_buffers = 512MB
effective_cache_size = 2GB
work_mem = 8MB
maintenance_work_mem = 128MB
```

### Cache Layer
```redis
# Redis optimization
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1 300 10 60 10000
```

## Monitoring and Observability

### Health Checks
```bash
# Application health
curl http://localhost:3000/health

# Detailed health with dependencies
curl http://localhost:3000/health/detailed

# Prometheus metrics
curl http://localhost:3000/metrics
```

### Logging Strategy
- **Development**: Console output with colors
- **Production**: JSON structured logs
- **Rotation**: 10MB max, 3 files retained
- **Centralization**: ELK stack integration ready

### Metrics Collection
- **Application**: Custom business metrics
- **System**: Container resource usage
- **Database**: Query performance, connections
- **Cache**: Hit rates, memory usage

## Deployment Strategies

### Development Deployment
```bash
# Hot reload development
docker-compose up --build

# Background services only
docker-compose -f docker-compose.dev.yml up -d
npm run start:dev
```

### Production Deployment
```bash
# Blue-green deployment
docker-compose -f docker-compose.prod.yml up -d --scale library-service=2

# Rolling updates
docker-compose -f docker-compose.prod.yml up -d --no-deps library-service

# Health check before traffic routing
./scripts/health-check.sh
```

### Kubernetes Ready
```yaml
# Example Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: library-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: library-service
  template:
    spec:
      containers:
      - name: library-service
        image: library-service:prod
        ports:
        - containerPort: 3000
        resources:
          limits:
            cpu: 1000m
            memory: 512Mi
          requests:
            cpu: 500m
            memory: 256Mi
```

## Troubleshooting Guide

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check port usage
   netstat -tulpn | grep :3000
   # Kill conflicting processes
   sudo fuser -k 3000/tcp
   ```

2. **Memory Issues**
   ```bash
   # Increase Docker memory
   docker system prune -a
   # Check container memory usage
   docker stats
   ```

3. **Database Connection Issues**
   ```bash
   # Test database connectivity
   docker-compose exec postgres pg_isready -U postgres
   # Check logs
   docker-compose logs postgres
   ```

4. **Cache Issues**
   ```bash
   # Test Redis connectivity
   docker-compose exec redis redis-cli ping
   # Clear cache
   docker-compose exec redis redis-cli FLUSHALL
   ```

### Debug Commands
```bash
# Container shell access
docker-compose exec library-service sh

# View real-time logs
docker-compose logs -f --tail=100 library-service

# Inspect container configuration
docker inspect library-service-dev

# Network debugging
docker network ls
docker network inspect library-service_library-network
```

### Performance Debugging
```bash
# Application performance
curl http://localhost:3000/metrics | grep http_request_duration

# Database performance
docker-compose exec postgres psql -U postgres -d library_service -c "SELECT * FROM pg_stat_activity;"

# Cache performance
docker-compose exec redis redis-cli info stats
```

## Backup and Recovery

### Database Backup
```bash
# Create backup
docker-compose exec postgres pg_dump -U postgres library_service > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U postgres library_service < backup.sql
```

### Volume Backup
```bash
# Backup volumes
docker run --rm -v library-service_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data

# Restore volumes
docker run --rm -v library-service_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-backup.tar.gz -C /
```

## Integration with Platform

### Service Discovery
- Compatible with Consul/Eureka
- Health check endpoints for load balancers
- Graceful shutdown handling

### API Gateway Integration
- Standardized REST API endpoints
- OpenAPI/Swagger documentation
- Request/response logging

### Monitoring Integration
- Prometheus metrics export
- Grafana dashboard templates
- Alert manager rules

This Docker setup follows the unified platform standards and provides a production-ready containerization solution for the Library Service.