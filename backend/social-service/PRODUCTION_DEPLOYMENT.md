# Social Service - Production Deployment Guide

This guide covers the production deployment of the Social Service MVP for the Russian Gaming Platform.

## 🏗️ Architecture Overview

The Social Service is designed for production deployment with:
- **Multi-stage Docker builds** for optimized container images
- **Kubernetes-native** deployment with health checks, auto-scaling, and graceful shutdown
- **Production logging** with structured JSON output
- **Security hardening** with non-root containers and network policies
- **Monitoring ready** with Prometheus metrics endpoints

## 📋 Prerequisites

### Required Tools
- Docker 20.10+
- Kubernetes 1.20+
- kubectl configured for your cluster
- Helm 3.0+ (optional, for advanced deployments)

### Infrastructure Requirements
- **PostgreSQL 13+** database
- **Redis 6+** cache server
- **Kubernetes cluster** with:
  - Ingress controller
  - Metrics server (for HPA)
  - Network policy support (optional)

## 🚀 Quick Start

### 1. Build Production Image

```bash
# Build optimized production image
docker build -t social-service:v1.0.0 .

# Tag for your registry
docker tag social-service:v1.0.0 your-registry.com/social-service:v1.0.0

# Push to registry
docker push your-registry.com/social-service:v1.0.0
```

### 2. Create Kubernetes Secrets

```bash
# Create database and service secrets
kubectl create secret generic social-service-secrets \
  --from-literal=DATABASE_HOST=your-postgres-host \
  --from-literal=DATABASE_USERNAME=social_user \
  --from-literal=DATABASE_PASSWORD=your-secure-password \
  --from-literal=REDIS_HOST=your-redis-host \
  --from-literal=REDIS_PASSWORD=your-redis-password \
  --from-literal=INTERNAL_API_TOKEN=your-internal-api-token \
  --from-literal=JWT_SECRET=your-jwt-secret \
  --namespace=your-namespace
```

### 3. Deploy to Kubernetes

```bash
# Using the deployment script (Linux/macOS)
cd deploy
./deploy-production.sh

# Using PowerShell (Windows)
cd deploy
.\deploy-production.ps1

# Or manually apply manifests
kubectl apply -f deploy/k8s/ --namespace=your-namespace
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `production` | Yes |
| `PORT` | Service port | `3003` | No |
| `DATABASE_HOST` | PostgreSQL host | - | Yes |
| `DATABASE_PORT` | PostgreSQL port | `5432` | No |
| `DATABASE_USERNAME` | Database user | - | Yes |
| `DATABASE_PASSWORD` | Database password | - | Yes |
| `DATABASE_NAME` | Database name | `social_db` | No |
| `REDIS_HOST` | Redis host | - | Yes |
| `REDIS_PORT` | Redis port | `6379` | No |
| `REDIS_PASSWORD` | Redis password | - | No |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `INTERNAL_API_TOKEN` | Internal service token | - | Yes |
| `LOG_LEVEL` | Logging level | `info` | No |
| `LOG_FORMAT` | Log format | `json` | No |
| `CORS_ORIGIN` | CORS allowed origins | `*` | No |
| `SWAGGER_ENABLED` | Enable Swagger docs | `false` | No |

### Resource Requirements

#### Minimum Resources
- **CPU**: 200m (0.2 cores)
- **Memory**: 512Mi
- **Storage**: 1Gi (for logs)

#### Recommended Resources
- **CPU**: 500m-1000m (0.5-1 cores)
- **Memory**: 1Gi
- **Storage**: 5Gi

#### Auto-scaling Configuration
- **Min Replicas**: 2
- **Max Replicas**: 10
- **CPU Target**: 70%
- **Memory Target**: 80%

## 🏥 Health Checks

The service provides multiple health check endpoints:

### Basic Health Check
```bash
curl http://localhost:3003/v1/health
```

### Detailed Health Check
```bash
curl http://localhost:3003/v1/health/detailed
```

### Kubernetes Probes
- **Liveness**: `/v1/health/live`
- **Readiness**: `/v1/health/ready`
- **Startup**: `/v1/health`

## 📊 Monitoring

### Metrics Endpoints
- **Health**: `/v1/health`
- **Metrics**: `/metrics` (Prometheus format)
- **Circuit Breakers**: `/v1/health/circuits`

### Key Metrics to Monitor
- **Response Time**: < 200ms (95th percentile)
- **Error Rate**: < 1%
- **Memory Usage**: < 80%
- **CPU Usage**: < 70%
- **Database Connections**: Monitor pool usage
- **Redis Connections**: Monitor cache hit rate

## 🔒 Security

### Container Security
- **Non-root user**: Runs as user `nestjs` (UID 1001)
- **Read-only filesystem**: Where possible
- **No privileged escalation**
- **Minimal base image**: Alpine Linux

### Network Security
- **Network Policies**: Restrict ingress/egress traffic
- **TLS**: Enable for all external communications
- **Secrets Management**: Use Kubernetes secrets

### Application Security
- **Input Validation**: All inputs validated
- **Rate Limiting**: Configured per endpoint
- **JWT Authentication**: Required for all endpoints
- **CORS**: Configured for allowed origins

## 🚨 Troubleshooting

### Common Issues

#### Pod Not Starting
```bash
# Check pod status
kubectl get pods -l app=social-service

# Check pod logs
kubectl logs -f deployment/social-service

# Check events
kubectl describe pod <pod-name>
```

#### Database Connection Issues
```bash
# Test database connectivity
kubectl exec -it <pod-name> -- nc -zv postgres-host 5432

# Check database credentials
kubectl get secret social-service-secrets -o yaml
```

#### High Memory Usage
```bash
# Check memory metrics
kubectl top pods -l app=social-service

# Check for memory leaks in logs
kubectl logs -f deployment/social-service | grep -i memory
```

### Performance Tuning

#### Database Optimization
- **Connection Pooling**: Configure appropriate pool size
- **Query Optimization**: Monitor slow queries
- **Indexing**: Ensure proper indexes on friendship and message tables

#### Cache Optimization
- **Redis Configuration**: Tune memory and eviction policies
- **Cache TTL**: Optimize cache expiration times
- **Cache Hit Rate**: Monitor and improve cache efficiency

#### Application Tuning
- **Node.js**: Tune garbage collection settings
- **TypeORM**: Optimize query patterns
- **Rate Limiting**: Adjust limits based on usage patterns

## 📈 Scaling

### Horizontal Scaling
The service supports horizontal scaling through:
- **Kubernetes HPA**: Automatic scaling based on CPU/memory
- **Load Balancing**: Kubernetes service load balancing
- **Stateless Design**: No local state dependencies

### Vertical Scaling
For increased performance per pod:
- **CPU**: Increase CPU limits for compute-intensive operations
- **Memory**: Increase memory for larger cache sizes
- **Database**: Scale database resources independently

## 🔄 Updates and Rollbacks

### Rolling Updates
```bash
# Update image
kubectl set image deployment/social-service social-service=new-image:tag

# Check rollout status
kubectl rollout status deployment/social-service

# Check rollout history
kubectl rollout history deployment/social-service
```

### Rollbacks
```bash
# Rollback to previous version
kubectl rollout undo deployment/social-service

# Rollback to specific revision
kubectl rollout undo deployment/social-service --to-revision=2
```

## 📝 Maintenance

### Regular Tasks
- **Log Rotation**: Ensure logs don't fill disk space
- **Database Maintenance**: Regular VACUUM and ANALYZE
- **Cache Cleanup**: Monitor Redis memory usage
- **Security Updates**: Keep base images updated

### Backup Strategy
- **Database**: Regular PostgreSQL backups
- **Configuration**: Version control all Kubernetes manifests
- **Secrets**: Secure backup of secrets (encrypted)

## 🆘 Support

For production issues:
1. Check service health endpoints
2. Review application logs
3. Monitor system metrics
4. Check external service dependencies
5. Escalate to development team if needed

### Emergency Contacts
- **Development Team**: [team-email]
- **DevOps Team**: [devops-email]
- **On-call Engineer**: [on-call-contact]