# Production Deployment Guide

## Overview

This guide covers the production deployment of the Review Service MVP, including Docker containerization, Kubernetes deployment, monitoring, and load testing.

## Prerequisites

- Docker 20.10+
- Kubernetes 1.24+
- kubectl configured for your cluster
- Node.js 20+ (for local testing)
- 4GB+ RAM available for the service
- PostgreSQL 14+ database
- Redis 6+ cache

## Quick Start

### 1. Build Production Docker Image

```bash
# Build optimized production image
npm run docker:build:prod

# Or build with specific tag
docker build --target production -t review-service:v1.0.0 .
```

### 2. Deploy to Kubernetes

```bash
# Apply all Kubernetes manifests
npm run k8s:apply

# Or apply individually
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/serviceaccount.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/pdb.yaml
```

### 3. Verify Deployment

```bash
# Check pod status
kubectl get pods -n review-service

# Check service health
kubectl port-forward service/review-service 3004:3004 -n review-service
curl http://localhost:3004/api/v1/health

# View logs
npm run k8s:logs
```

## Configuration

### Environment Variables

Update the ConfigMap and Secret in `k8s/` directory:

#### ConfigMap (`k8s/configmap.yaml`)
- `NODE_ENV`: production
- `LOG_LEVEL`: info
- `DB_HOST`: Your PostgreSQL host
- `REDIS_HOST`: Your Redis host
- External service URLs

#### Secret (`k8s/secret.yaml`)
- `DB_PASSWORD`: Base64 encoded database password
- `JWT_SECRET`: Base64 encoded JWT secret
- `WEBHOOK_SECRET`: Base64 encoded webhook secret
- API keys for external services

### Resource Requirements

Default resource allocation per pod:
- **Requests**: 250m CPU, 256Mi RAM
- **Limits**: 500m CPU, 512Mi RAM
- **Replicas**: 3 (minimum), 10 (maximum)

Adjust in `k8s/deployment.yaml` based on your needs.

## Health Checks

The service provides multiple health check endpoints:

### Endpoints

- `GET /api/v1/health` - Comprehensive health check
- `GET /api/v1/health/ready` - Readiness probe
- `GET /api/v1/health/live` - Liveness probe

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /api/v1/health/live
    port: 3004
  initialDelaySeconds: 60
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /api/v1/health/ready
    port: 3004
  initialDelaySeconds: 30
  periodSeconds: 10

startupProbe:
  httpGet:
    path: /api/v1/health
    port: 3004
  initialDelaySeconds: 10
  periodSeconds: 10
  failureThreshold: 30
```

## Monitoring

### Prometheus Metrics

Metrics are exposed at `/metrics` endpoint:

- `rating_calculations_total` - Total rating calculations
- `rating_cache_operations_total` - Cache operations
- `webhooks_received_total` - Webhooks received
- `webhooks_processed_total` - Webhooks processed
- Response time histograms and more

### Integration Monitoring

Monitor service integrations:

```bash
# Start integration monitor
npm run monitor:integrations

# Fast monitoring (10s intervals)
npm run monitor:integrations:fast
```

### Grafana Dashboard

Import the provided Grafana dashboard configuration for visualization.

## Load Testing

### Performance Testing

Test with 1000 concurrent users:

```bash
# Full load test (1000 users, 5 minutes)
npm run test:load

# Light load test (100 users, 2 minutes)
npm run test:load:light

# Custom load test
node load-test/load-test.js --users 500 --url http://your-service-url --rampup 30 --duration 180
```

### Expected Performance

For 1000 concurrent users:
- **Success Rate**: > 99%
- **Average Response Time**: < 100ms
- **95th Percentile**: < 500ms
- **Throughput**: > 100 RPS

## Security

### Container Security

- Runs as non-root user (UID 1001)
- Read-only root filesystem
- No privileged escalation
- Minimal Alpine Linux base image
- Security updates applied

### Network Security

- Service-to-service communication via Kubernetes services
- Secrets managed via Kubernetes Secrets
- RBAC configured with minimal permissions

### Authentication

- JWT-based authentication
- Webhook signature verification
- API key validation for external services

## Scaling

### Horizontal Pod Autoscaler (HPA)

Automatic scaling based on:
- CPU utilization (target: 70%)
- Memory utilization (target: 80%)
- Min replicas: 3
- Max replicas: 10

### Manual Scaling

```bash
# Scale to 5 replicas
kubectl scale deployment review-service --replicas=5 -n review-service

# Update HPA limits
kubectl patch hpa review-service-hpa -n review-service -p '{"spec":{"maxReplicas":15}}'
```

## Troubleshooting

### Common Issues

#### Pod Not Starting

```bash
# Check pod events
kubectl describe pod <pod-name> -n review-service

# Check logs
kubectl logs <pod-name> -n review-service

# Check resource constraints
kubectl top pods -n review-service
```

#### Database Connection Issues

```bash
# Test database connectivity
kubectl exec -it <pod-name> -n review-service -- sh
# Inside pod:
nc -zv $DB_HOST $DB_PORT
```

#### High Memory Usage

```bash
# Check memory metrics
kubectl top pods -n review-service

# Analyze heap dumps (if enabled)
kubectl exec -it <pod-name> -n review-service -- node --inspect
```

### Performance Issues

1. **High Response Times**
   - Check database query performance
   - Verify Redis cache hit rates
   - Review external service response times

2. **Low Throughput**
   - Increase replica count
   - Optimize database indexes
   - Review connection pool settings

3. **Memory Leaks**
   - Monitor heap usage over time
   - Check for unclosed connections
   - Review event listener cleanup

## Backup and Recovery

### Database Backups

Ensure PostgreSQL backups are configured:
- Daily full backups
- Point-in-time recovery enabled
- Backup retention: 30 days

### Configuration Backups

```bash
# Backup Kubernetes configurations
kubectl get all,configmap,secret -n review-service -o yaml > review-service-backup.yaml
```

## Rollback Procedures

### Kubernetes Rollback

```bash
# Check rollout history
kubectl rollout history deployment/review-service -n review-service

# Rollback to previous version
kubectl rollout undo deployment/review-service -n review-service

# Rollback to specific revision
kubectl rollout undo deployment/review-service --to-revision=2 -n review-service
```

### Docker Image Rollback

```bash
# Update deployment with previous image
kubectl set image deployment/review-service review-service=review-service:v1.0.0 -n review-service
```

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review performance metrics
   - Check error logs
   - Verify backup integrity

2. **Monthly**
   - Update dependencies
   - Review resource usage
   - Performance testing

3. **Quarterly**
   - Security audit
   - Disaster recovery testing
   - Capacity planning

### Updates

```bash
# Update deployment
kubectl set image deployment/review-service review-service=review-service:v1.1.0 -n review-service

# Monitor rollout
kubectl rollout status deployment/review-service -n review-service
```

## Support

### Logs

```bash
# Application logs
kubectl logs -f deployment/review-service -n review-service

# Previous container logs
kubectl logs deployment/review-service -n review-service --previous

# All pods logs
kubectl logs -l app.kubernetes.io/name=review-service -n review-service
```

### Metrics

Access metrics at:
- Health: `http://service-url/api/v1/health`
- Metrics: `http://service-url/metrics`
- Summary: `http://service-url/api/v1/metrics/summary`

### Emergency Contacts

- DevOps Team: devops@company.com
- On-call Engineer: +1-xxx-xxx-xxxx
- Incident Management: incidents@company.com

---

## Checklist

Before going to production:

- [ ] Database migrations applied
- [ ] Secrets configured and secured
- [ ] Resource limits set appropriately
- [ ] Health checks configured
- [ ] Monitoring and alerting set up
- [ ] Load testing completed successfully
- [ ] Backup procedures verified
- [ ] Rollback procedures tested
- [ ] Documentation updated
- [ ] Team trained on operations

---

*Last updated: $(date)*