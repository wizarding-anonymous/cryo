# Auth Service Deployment Guide

Comprehensive guide for deploying the Auth Service in different environments with Docker and Kubernetes.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Security Considerations](#security-considerations)
- [Monitoring and Health Checks](#monitoring-and-health-checks)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software
- Docker 20.10+
- Docker Compose 2.0+
- Node.js 18+ (for local development)
- kubectl (for Kubernetes deployment)
- Kubernetes cluster 1.24+

### Required Services
- PostgreSQL 15+
- Redis 7+
- User Service (microservice dependency)
- Security Service (microservice dependency)
- Notification Service (microservice dependency)

## Environment Configuration

### Environment Variables

#### Required Variables
```bash
# Database Configuration
POSTGRES_AUTH_HOST=localhost
POSTGRES_AUTH_PORT=5432
POSTGRES_AUTH_USER=auth_service
POSTGRES_AUTH_PASSWORD=secure_password
POSTGRES_AUTH_DB=auth_db

# Redis Configuration
AUTH_REDIS_HOST=localhost
AUTH_REDIS_PORT=6379
AUTH_REDIS_PASSWORD=redis_password

# JWT Configuration
AUTH_JWT_SECRET=your-super-secret-jwt-key-change-in-production
AUTH_JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
AUTH_JWT_EXPIRES_IN=15m
AUTH_JWT_REFRESH_EXPIRES_IN=7d

# Service URLs
USER_SERVICE_URL=http://user-service:3002
SECURITY_SERVICE_URL=http://security-service:3010
NOTIFICATION_SERVICE_URL=http://notification-service:3007
```

#### Optional Variables
```bash
# Application Configuration
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100
THROTTLE_STRICT_LIMIT=10

# Session Configuration
SESSION_MAX_CONCURRENT=5
SESSION_CLEANUP_INTERVAL=3600000

# Health Check Configuration
HEALTH_CHECK_TIMEOUT=5000
HEALTH_CHECK_RETRIES=2
HEALTH_CHECK_SILENT=true
```

### Environment Files

Create environment files for different deployment scenarios:

#### `.env.docker` (Docker Compose)
```bash
NODE_ENV=production
PORT=3001
POSTGRES_AUTH_HOST=postgres-auth
POSTGRES_AUTH_DB=auth_db
POSTGRES_AUTH_USER=auth_service
POSTGRES_AUTH_PASSWORD=auth_password
AUTH_REDIS_HOST=redis
AUTH_REDIS_PASSWORD=redis_password
USER_SERVICE_URL=http://user-service:3002
SECURITY_SERVICE_URL=http://security-service:3010
NOTIFICATION_SERVICE_URL=http://notification-service:3007
```

#### `.env.production` (Production)
```bash
NODE_ENV=production
PORT=3001
# Use actual production values
POSTGRES_AUTH_HOST=prod-postgres.example.com
POSTGRES_AUTH_PASSWORD=actual-secure-password
AUTH_REDIS_PASSWORD=actual-redis-password
AUTH_JWT_SECRET=actual-jwt-secret-64-chars-minimum
AUTH_JWT_REFRESH_SECRET=actual-refresh-secret-64-chars-minimum
```

## Docker Deployment

### Single Container Deployment

#### Build and Run
```bash
# Build the Docker image
make docker-build

# Run with environment file
docker run -d \
  --name auth-service \
  -p 3001:3001 \
  --env-file .env.docker \
  auth-service:latest

# Check health
make health-check
```

#### Production Container
```bash
# Build production image
make docker-build-prod

# Run with security hardening
make docker-run-prod

# Verify security settings
docker inspect auth-service-prod | jq '.[0].HostConfig.SecurityOpt'
```

### Docker Compose Deployment

#### From Backend Directory
```bash
cd backend

# Start Auth Service with dependencies
docker-compose up -d postgres-auth redis auth-service

# Check logs
docker-compose logs -f auth-service

# Run health checks
docker-compose exec auth-service node health-check.js --comprehensive
```

#### With Override File
```bash
# Use security-enhanced configuration
docker-compose -f docker-compose.yml -f auth-service/docker-compose.override.yml up -d auth-service

# Monitor resource usage
docker stats auth-service
```

### Docker Security Features

The production Docker image includes:

- **Non-root user**: Runs as `nestjs:nodejs` (UID 1001)
- **Read-only filesystem**: Root filesystem is read-only
- **Temporary filesystems**: Writable directories use tmpfs
- **Security options**: `no-new-privileges:true`
- **Resource limits**: CPU, memory, and PID limits
- **Health checks**: Built-in health monitoring

## Kubernetes Deployment

### Prerequisites

1. **Namespace**: Create the gaming-platform namespace
```bash
kubectl create namespace gaming-platform
```

2. **Secrets**: Create secrets from template
```bash
# Generate secure secrets
kubectl create secret generic auth-service-secrets \
  --from-literal=AUTH_JWT_SECRET=$(openssl rand -base64 64) \
  --from-literal=AUTH_JWT_REFRESH_SECRET=$(openssl rand -base64 64) \
  --from-literal=POSTGRES_AUTH_PASSWORD=$(openssl rand -base64 32) \
  --from-literal=AUTH_REDIS_PASSWORD=$(openssl rand -base64 32) \
  --from-literal=ENCRYPTION_KEY=$(openssl rand -base64 32) \
  --from-literal=SESSION_SECRET=$(openssl rand -base64 64) \
  --namespace=gaming-platform
```

### Deployment Steps

#### 1. Deploy Configuration
```bash
# Apply ConfigMap
kubectl apply -f k8s/configmap.yaml

# Verify configuration
kubectl get configmap auth-service-config -n gaming-platform -o yaml
```

#### 2. Deploy Service
```bash
# Apply Service
kubectl apply -f k8s/service.yaml

# Verify service
kubectl get svc auth-service -n gaming-platform
```

#### 3. Deploy Application
```bash
# Apply Deployment
kubectl apply -f k8s/deployment.yaml

# Wait for rollout
kubectl rollout status deployment/auth-service -n gaming-platform --timeout=300s
```

#### 4. Deploy Autoscaling
```bash
# Apply HPA
kubectl apply -f k8s/hpa.yaml

# Check autoscaler status
kubectl get hpa auth-service-hpa -n gaming-platform
```

#### 5. Verify Deployment
```bash
# Check pods
kubectl get pods -l app=auth-service -n gaming-platform

# Check logs
kubectl logs -l app=auth-service -n gaming-platform --tail=100

# Test health endpoints
kubectl port-forward svc/auth-service 3001:3001 -n gaming-platform &
curl http://localhost:3001/api/health/ready
```

### Using Makefile Commands
```bash
# Deploy everything
make k8s-deploy

# Check status
make k8s-status

# Delete deployment
make k8s-delete
```

### Kubernetes Security Features

The Kubernetes deployment includes:

- **Security Context**: Non-root user, read-only filesystem
- **Resource Limits**: CPU, memory, and ephemeral storage limits
- **Health Probes**: Liveness, readiness, and startup probes
- **Pod Security**: Security context and capabilities dropping
- **Network Policies**: Service mesh integration ready
- **RBAC**: Service account with minimal permissions

## Security Considerations

### Container Security

1. **Image Scanning**: Run security scans before deployment
```bash
make security-docker
```

2. **Runtime Security**: Use security-hardened runtime
```bash
# Docker with security options
docker run --security-opt no-new-privileges:true --read-only auth-service:prod
```

3. **Network Security**: Use encrypted communication
```bash
# Enable TLS for Redis
AUTH_REDIS_TLS=true
AUTH_REDIS_TLS_CERT_PATH=/certs/redis.crt
```

### Secrets Management

1. **Environment Variables**: Never commit secrets to code
2. **External Secret Management**: Use Vault, AWS Secrets Manager, etc.
3. **Secret Rotation**: Implement automated secret rotation
4. **Encryption**: Encrypt secrets at rest and in transit

### Access Control

1. **RBAC**: Implement role-based access control
2. **Network Policies**: Restrict network access
3. **Service Mesh**: Use Istio or similar for mTLS
4. **API Gateway**: Route through authenticated gateway

## Monitoring and Health Checks

### Health Endpoints

The service provides multiple health check endpoints:

- `/api/health` - Overall health status
- `/api/health/ready` - Kubernetes readiness probe
- `/api/health/live` - Kubernetes liveness probe
- `/api/health/redis` - Redis connectivity
- `/api/health/database` - Database connectivity

### Health Check Script

```bash
# Comprehensive health check
node health-check.js --comprehensive

# Specific endpoint check
node health-check.js --endpoint /api/health/ready

# Silent mode for automation
HEALTH_CHECK_SILENT=true node health-check.js
```

### Monitoring Integration

#### Prometheus Metrics
```yaml
# ServiceMonitor for Prometheus Operator
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: auth-service
spec:
  selector:
    matchLabels:
      app: auth-service
  endpoints:
  - port: http
    path: /api/metrics
```

#### Grafana Dashboard
- Authentication request rate
- Response time percentiles
- Error rate and types
- JWT token metrics
- Session metrics
- Database connection pool

#### Alerting Rules
- High error rate (>5%)
- High response time (>500ms p95)
- Database connection failures
- Redis connection failures
- JWT token validation failures

## Troubleshooting

### Common Issues

#### 1. Service Won't Start
```bash
# Check logs
kubectl logs -l app=auth-service -n gaming-platform

# Common causes:
# - Missing environment variables
# - Database connection failure
# - Redis connection failure
# - Port already in use
```

#### 2. Health Checks Failing
```bash
# Test health endpoints manually
kubectl port-forward svc/auth-service 3001:3001 -n gaming-platform
curl -v http://localhost:3001/api/health/ready

# Check dependencies
curl -v http://localhost:3001/api/health/database
curl -v http://localhost:3001/api/health/redis
```

#### 3. Authentication Failures
```bash
# Check JWT configuration
kubectl get secret auth-service-secrets -n gaming-platform -o yaml

# Verify service connectivity
kubectl exec -it deployment/auth-service -n gaming-platform -- \
  curl http://user-service:3002/health
```

#### 4. Performance Issues
```bash
# Check resource usage
kubectl top pods -l app=auth-service -n gaming-platform

# Check HPA status
kubectl get hpa auth-service-hpa -n gaming-platform

# Scale manually if needed
kubectl scale deployment auth-service --replicas=5 -n gaming-platform
```

### Debug Commands

```bash
# Get detailed pod information
kubectl describe pod -l app=auth-service -n gaming-platform

# Check events
kubectl get events -n gaming-platform --sort-by='.lastTimestamp'

# Access pod shell
kubectl exec -it deployment/auth-service -n gaming-platform -- /bin/sh

# Check configuration
kubectl exec -it deployment/auth-service -n gaming-platform -- env | grep AUTH
```

### Log Analysis

```bash
# Stream logs
kubectl logs -f -l app=auth-service -n gaming-platform

# Search for errors
kubectl logs -l app=auth-service -n gaming-platform | grep -i error

# Export logs for analysis
kubectl logs -l app=auth-service -n gaming-platform --since=1h > auth-service-logs.txt
```

## Performance Tuning

### Resource Optimization

1. **Memory**: Adjust Node.js heap size
```bash
NODE_OPTIONS=--max-old-space-size=768
```

2. **CPU**: Optimize thread pool size
```bash
UV_THREADPOOL_SIZE=4
```

3. **Database**: Connection pooling
```typescript
// TypeORM configuration
{
  type: 'postgres',
  poolSize: 10,
  extra: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
  }
}
```

### Scaling Configuration

```yaml
# HPA configuration
spec:
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Backup and Recovery

### Database Backup
```bash
# PostgreSQL backup
kubectl exec -it postgres-auth-0 -n gaming-platform -- \
  pg_dump -U auth_service auth_db > auth-db-backup.sql
```

### Configuration Backup
```bash
# Export Kubernetes resources
kubectl get all,configmap,secret -l app=auth-service -n gaming-platform -o yaml > auth-service-backup.yaml
```

### Disaster Recovery
1. **Database**: Restore from backup
2. **Configuration**: Apply from backup files
3. **Secrets**: Regenerate and apply
4. **Verification**: Run health checks

This deployment guide provides comprehensive instructions for deploying the Auth Service securely and reliably in production environments.