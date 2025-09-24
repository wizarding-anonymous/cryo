# Security Service Deployment Guide

This guide provides comprehensive instructions for deploying the Security Service in different environments using Docker, Kubernetes, and Helm.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Deployment Methods](#deployment-methods)
  - [Docker Compose](#docker-compose)
  - [Kubernetes with kubectl](#kubernetes-with-kubectl)
  - [Helm Chart](#helm-chart)
- [Environment Configuration](#environment-configuration)
- [Health Checks](#health-checks)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

## Prerequisites

### Required Tools

- **Docker** (20.10+)
- **Docker Compose** (2.0+)
- **Kubernetes** (1.19+)
- **kubectl** (configured for your cluster)
- **Helm** (3.0+) - for Helm deployments

### Required Infrastructure

- **PostgreSQL** (15+) - Primary database
- **Redis** (7+) - Caching and rate limiting
- **Apache Kafka** (optional) - Event streaming

## Quick Start

### Using Docker Compose (Development)

```bash
# Clone and navigate to the project
cd backend/security-service

# Copy environment file
cp .env.example .env

# Start all services
./scripts/deploy.sh docker
# or on Windows
scripts\deploy.bat docker
```

### Using Helm (Production)

```bash
# Deploy to production
./scripts/deploy.sh helm -e production -n security-prod -t v1.0.0
```

## Deployment Methods

### Docker Compose

Best for local development and testing.

#### Features
- Includes PostgreSQL and Redis
- Automatic service discovery
- Volume persistence
- Health checks
- Log aggregation

#### Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f security-service

# Stop services
docker-compose down

# Clean up (including volumes)
docker-compose down -v
```

#### Configuration

Environment variables are loaded from `.env` file:

```env
# Database
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=security_service

# Redis
REDIS_PASSWORD=

# Security
JWT_SECRET=your-jwt-secret
```

### Kubernetes with kubectl

Direct deployment using Kubernetes manifests.

#### Features
- Production-ready configuration
- Resource limits and requests
- Health checks and probes
- Network policies
- Horizontal Pod Autoscaler
- Pod Disruption Budget

#### Commands

```bash
# Create namespace
kubectl create namespace security-service

# Apply all manifests
kubectl apply -f k8s/ -n security-service

# Check deployment status
kubectl rollout status deployment/security-service -n security-service

# View pods
kubectl get pods -n security-service

# View logs
kubectl logs -f deployment/security-service -n security-service
```

#### Manifests Overview

- `deployment.yaml` - Main application deployment
- `service.yaml` - Service for internal communication
- `configmap.yaml` - Configuration variables
- `secret.yaml` - Sensitive configuration
- `serviceaccount.yaml` - Service account
- `hpa.yaml` - Horizontal Pod Autoscaler
- `pdb.yaml` - Pod Disruption Budget
- `networkpolicy.yaml` - Network security policies

### Helm Chart

Recommended for production deployments with multiple environments.

#### Features
- Environment-specific configurations
- Templated manifests
- Easy upgrades and rollbacks
- Values validation
- Dependency management

#### Commands

```bash
# Install chart
helm install security-service helm/security-service \
  --namespace security-service \
  --create-namespace \
  --values helm/security-service/values-production.yaml

# Upgrade deployment
helm upgrade security-service helm/security-service \
  --namespace security-service \
  --values helm/security-service/values-production.yaml

# Check status
helm status security-service -n security-service

# Rollback
helm rollback security-service 1 -n security-service

# Uninstall
helm uninstall security-service -n security-service
```

#### Chart Structure

```
helm/security-service/
├── Chart.yaml                 # Chart metadata
├── values.yaml               # Default values
├── values-development.yaml   # Development overrides
├── values-staging.yaml       # Staging overrides
├── values-production.yaml    # Production overrides
└── templates/
    ├── deployment.yaml       # Deployment template
    ├── service.yaml         # Service template
    ├── configmap.yaml       # ConfigMap template
    ├── secret.yaml          # Secret template
    ├── ingress.yaml         # Ingress template
    ├── hpa.yaml             # HPA template
    ├── pdb.yaml             # PDB template
    ├── networkpolicy.yaml   # NetworkPolicy template
    ├── serviceaccount.yaml  # ServiceAccount template
    └── _helpers.tpl         # Template helpers
```

## Environment Configuration

### Development

- Single replica
- Debug logging
- Relaxed security thresholds
- No network policies
- Local database connections

```bash
./scripts/deploy.sh helm -e development
```

### Staging

- 2 replicas
- Info logging
- Production-like security
- Network policies enabled
- Staging database connections

```bash
./scripts/deploy.sh helm -e staging -n security-staging
```

### Production

- 3+ replicas with autoscaling
- Warn/Error logging only
- Strict security thresholds
- Full security policies
- Production database connections
- SSL/TLS enabled

```bash
./scripts/deploy.sh helm -e production -n security-prod -t v1.0.0
```

## Health Checks

The service provides multiple health check endpoints:

### Endpoints

- `GET /api/health` - Basic health check
- `GET /api/health/live` - Liveness probe (Kubernetes)
- `GET /api/health/ready` - Readiness probe (Kubernetes)

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /api/health/live
    port: 3008
  initialDelaySeconds: 15
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 3008
  initialDelaySeconds: 10
  periodSeconds: 5

startupProbe:
  httpGet:
    path: /api/health/live
    port: 3008
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 30
```

### Health Check Response

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "security-service",
  "check": "ready",
  "dependencies": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  },
  "details": {
    "uptime": 3600,
    "memory": {
      "rss": 67108864,
      "heapTotal": 29360128,
      "heapUsed": 20971520
    },
    "version": "v18.17.0"
  }
}
```

## Monitoring

### Metrics

The service exposes Prometheus metrics at `/api/metrics`:

- HTTP request metrics
- Database connection metrics
- Redis connection metrics
- Security event metrics
- Custom business metrics

### Grafana Dashboard

A pre-configured Grafana dashboard is available at `monitoring/grafana-dashboard.json`.

### Prometheus Rules

Alert rules are defined in `monitoring/prometheus-rules.yaml`:

- High error rate alerts
- High response time alerts
- Database connection alerts
- Security threshold alerts

### Logging

Structured JSON logging with configurable levels:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Security check completed",
  "context": {
    "userId": "user123",
    "ip": "192.168.1.100",
    "riskScore": 25,
    "action": "login"
  },
  "correlationId": "req-123-456-789"
}
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

```bash
# Check database connectivity
kubectl exec -it deployment/security-service -n security-service -- \
  node -e "console.log('Testing DB connection...')"

# Check database service
kubectl get svc postgres -n security-service
```

#### 2. Redis Connection Failed

```bash
# Check Redis connectivity
kubectl exec -it deployment/security-service -n security-service -- \
  redis-cli -h redis ping

# Check Redis service
kubectl get svc redis -n security-service
```

#### 3. High Memory Usage

```bash
# Check memory usage
kubectl top pods -n security-service

# Increase memory limits
helm upgrade security-service helm/security-service \
  --set resources.limits.memory=1Gi
```

#### 4. Pod Startup Issues

```bash
# Check pod events
kubectl describe pod <pod-name> -n security-service

# Check logs
kubectl logs <pod-name> -n security-service --previous
```

### Debug Mode

Enable debug logging:

```bash
# For Helm deployment
helm upgrade security-service helm/security-service \
  --set env.LOG_LEVEL=debug

# For kubectl deployment
kubectl patch configmap security-service-config -n security-service \
  --patch '{"data":{"LOG_LEVEL":"debug"}}'
```

### Performance Tuning

#### Database Optimization

```yaml
env:
  DB_MAX_CONNECTIONS: "20"
  DB_QUERY_TIMEOUT: "30000"
  DB_STATEMENT_TIMEOUT: "60000"
```

#### Redis Optimization

```yaml
env:
  REDIS_CONNECT_TIMEOUT: "10000"
  REDIS_COMMAND_TIMEOUT: "5000"
  REDIS_MAX_RETRIES: "3"
```

#### Node.js Optimization

```yaml
env:
  NODE_OPTIONS: "--max-old-space-size=512"
  UV_THREADPOOL_SIZE: "4"
```

## Security Considerations

### Network Security

- Network policies restrict ingress/egress traffic
- TLS encryption for all external communications
- Service mesh integration (Istio/Linkerd) recommended

### Secrets Management

- Use Kubernetes secrets for sensitive data
- Consider external secret management (Vault, AWS Secrets Manager)
- Rotate secrets regularly

### Container Security

- Non-root user (UID 1001)
- Read-only root filesystem
- No privileged escalation
- Minimal base image (Alpine Linux)

### Database Security

- Encrypted connections (SSL/TLS)
- Least privilege database user
- Regular security updates
- Backup encryption

### Compliance

- GDPR compliance for EU users
- Russian data localization requirements
- Audit logging for security events
- Data retention policies

## Backup and Recovery

### Database Backup

```bash
# Create backup job
kubectl apply -f k8s/backup-cronjob.yaml

# Manual backup
kubectl create job --from=cronjob/postgres-backup manual-backup-$(date +%Y%m%d)
```

### Disaster Recovery

1. **Database Recovery**: Restore from latest backup
2. **Redis Recovery**: Rebuild cache from database
3. **Application Recovery**: Redeploy with same configuration
4. **Verification**: Run health checks and integration tests

## Scaling

### Horizontal Scaling

Automatic scaling based on CPU and memory:

```yaml
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

### Vertical Scaling

Increase resource limits:

```yaml
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2Gi
```

### Database Scaling

- Read replicas for read-heavy workloads
- Connection pooling (PgBouncer)
- Partitioning for large tables

## Maintenance

### Updates

```bash
# Update to new version
helm upgrade security-service helm/security-service \
  --set image.tag=v1.1.0

# Rollback if needed
helm rollback security-service 1
```

### Database Migrations

```bash
# Run migrations
kubectl exec -it deployment/security-service -n security-service -- \
  npm run migration:run
```

### Log Rotation

Logs are automatically rotated by Kubernetes. For custom log retention:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## Support

For deployment issues:

1. Check the troubleshooting section
2. Review logs and metrics
3. Consult the team documentation
4. Contact the security team

---

**Note**: Always test deployments in staging before production. Keep secrets secure and follow your organization's security policies.