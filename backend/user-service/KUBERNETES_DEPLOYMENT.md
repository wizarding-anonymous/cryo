# User Service Kubernetes Deployment Guide

## Overview

This document describes the Kubernetes deployment configuration for the User Service, including security hardening, resource optimization, health checks, and monitoring setup.

## Architecture

The User Service is deployed as a highly available microservice with the following components:

- **Deployment**: 3 replicas with rolling update strategy
- **Service**: ClusterIP service for internal communication
- **HPA**: Horizontal Pod Autoscaler for automatic scaling
- **VPA**: Vertical Pod Autoscaler for resource optimization
- **PDB**: Pod Disruption Budget for high availability
- **NetworkPolicy**: Network security policies
- **ServiceMonitor**: Prometheus monitoring integration
- **PrometheusRule**: Alert rules for monitoring

## Security Features

### Container Security
- **Non-root user**: Runs as user ID 1001
- **Read-only root filesystem**: Prevents runtime modifications
- **Security context**: Drops all capabilities, prevents privilege escalation
- **Resource limits**: CPU and memory limits to prevent resource exhaustion

### Network Security
- **NetworkPolicy**: Restricts ingress and egress traffic
- **Service mesh ready**: Annotations for Linkerd integration
- **Internal API protection**: API key authentication for internal endpoints

### RBAC
- **ServiceAccount**: Dedicated service account with minimal permissions
- **Role**: Limited permissions for ConfigMaps, Secrets, and Pods
- **RoleBinding**: Binds the service account to the role

## Resource Configuration

### Resource Requests and Limits
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "200m"
    ephemeral-storage: "1Gi"
  limits:
    memory: "1Gi"
    cpu: "1000m"
    ephemeral-storage: "2Gi"
```

### Autoscaling
- **HPA**: Scales from 3 to 15 replicas based on CPU (70%) and memory (80%)
- **VPA**: Automatically adjusts resource requests and limits
- **Scaling policies**: Conservative scale-down, aggressive scale-up

## Health Checks

### Probe Configuration
- **Liveness Probe**: `/api/health/live` - Checks if the application is alive
- **Readiness Probe**: `/api/health/ready` - Checks if ready to serve traffic
- **Startup Probe**: `/api/health/live` - Gives time for application startup

### Graceful Shutdown
- **Termination grace period**: 30 seconds
- **PreStop hook**: 15-second delay for connection draining
- **Application-level**: Graceful shutdown handling in main.ts

## Monitoring and Observability

### Prometheus Integration
- **ServiceMonitor**: Scrapes metrics every 15 seconds
- **Custom metrics**: User-specific metrics (cache hit rate, batch operations)
- **Alert rules**: 10 different alert conditions

### Grafana Dashboard
- **Request rate and response time**
- **Error rate and cache performance**
- **Resource utilization (CPU, memory)**
- **Custom business metrics**

### Logging
- **Structured logging**: JSON format for production
- **Correlation IDs**: Request tracing
- **Log levels**: Configurable via environment variables

## Deployment

### Prerequisites
- Kubernetes cluster (1.20+)
- kubectl configured
- Prometheus Operator (for monitoring)
- Shared infrastructure (PostgreSQL, Redis)

### Quick Deployment
```bash
# Linux/macOS
./scripts/deploy-k8s.sh

# Windows PowerShell
.\scripts\deploy-k8s.ps1
```

### Manual Deployment
```bash
# Apply manifests in order
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/serviceaccount.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/poddisruptionbudget.yaml
kubectl apply -f k8s/networkpolicy.yaml
kubectl apply -f k8s/servicemonitor.yaml
kubectl apply -f k8s/prometheusrule.yaml

# Wait for deployment
kubectl rollout status deployment/user-service-deployment -n microservices
```

### Using Kustomize
```bash
kubectl apply -k k8s/
```

## Configuration

### Environment Variables
Key configuration options available via ConfigMap:

- **NODE_ENV**: production
- **LOG_LEVEL**: info
- **LOG_FORMAT**: json
- **POSTGRES_MAX_CONNECTIONS**: 20
- **REDIS_KEY_PREFIX**: user-service:
- **CACHE_TTL**: 300
- **RATE_LIMIT_MAX**: 100

### Secrets
Required secrets in `microservices-secrets`:

- **POSTGRES_USER_PASSWORD**: Database password
- **REDIS_PASSWORD**: Redis password
- **ENCRYPTION_KEY**: Data encryption key
- **INTERNAL_API_KEY**: Internal API authentication

## Monitoring and Alerts

### Key Metrics
- `http_requests_total`: HTTP request counter
- `http_request_duration_seconds`: Request duration histogram
- `user_cache_hits_total`: Cache hit counter
- `user_batch_operations_total`: Batch operation counter
- `user_database_connections_active`: Active DB connections

### Alert Conditions
1. **High CPU Usage**: >80% for 5 minutes
2. **High Memory Usage**: >85% for 5 minutes
3. **High Restart Rate**: >0.1 restarts/minute
4. **Service Down**: Service unavailable for 1 minute
5. **High Response Time**: 95th percentile >1 second
6. **High Error Rate**: >5% error rate for 5 minutes
7. **Database Issues**: Connection failures
8. **Redis Issues**: Connection failures
9. **Low Cache Hit Rate**: <70% for 10 minutes
10. **Batch Operation Failures**: Failure rate >0.1/minute

## Troubleshooting

### Common Issues

#### Pod Not Starting
```bash
# Check pod status
kubectl get pods -n microservices -l app=user-service

# Check pod logs
kubectl logs -n microservices -l app=user-service --tail=100

# Check events
kubectl get events -n microservices --sort-by='.lastTimestamp'
```

#### Health Check Failures
```bash
# Port forward to test health endpoint
kubectl port-forward service/user-service -n microservices 8080:3002

# Test health endpoints
curl http://localhost:8080/api/health/live
curl http://localhost:8080/api/health/ready
```

#### Database Connection Issues
```bash
# Check database pod
kubectl get pods -n microservices -l app=postgres-user

# Check database logs
kubectl logs -n microservices -l app=postgres-user

# Test database connection from user service pod
kubectl exec -it deployment/user-service-deployment -n microservices -- sh
# Inside pod: nc -zv postgres-user 5432
```

#### Redis Connection Issues
```bash
# Check Redis pod
kubectl get pods -n microservices -l app=redis

# Test Redis connection
kubectl exec -it deployment/user-service-deployment -n microservices -- sh
# Inside pod: nc -zv redis 6379
```

### Performance Tuning

#### Resource Optimization
1. Monitor VPA recommendations
2. Adjust HPA thresholds based on traffic patterns
3. Tune database connection pool settings
4. Optimize cache TTL values

#### Scaling Configuration
```bash
# Manual scaling
kubectl scale deployment user-service-deployment -n microservices --replicas=5

# Check HPA status
kubectl get hpa -n microservices

# Check resource usage
kubectl top pods -n microservices -l app=user-service
```

## Security Considerations

### Network Policies
- Only allows traffic from authorized services
- Blocks unnecessary egress traffic
- DNS resolution allowed for service discovery

### Pod Security
- Runs as non-root user
- Read-only root filesystem where possible
- Minimal Linux capabilities
- Resource limits prevent DoS attacks

### Secrets Management
- All sensitive data in Kubernetes secrets
- Secrets mounted as environment variables
- Regular secret rotation recommended

## Backup and Recovery

### Database Backups
- PostgreSQL backups handled by database operator
- Point-in-time recovery available
- Regular backup testing recommended

### Configuration Backups
- Kubernetes manifests in version control
- ConfigMaps and Secrets backed up
- Disaster recovery procedures documented

## Maintenance

### Updates
1. Update Docker image tag in deployment
2. Apply rolling update
3. Monitor deployment progress
4. Verify health checks pass
5. Run smoke tests

### Scaling
- HPA handles automatic scaling
- Manual scaling for planned events
- Monitor resource usage trends
- Adjust limits based on usage patterns

## Integration with CI/CD

The service integrates with the main CI/CD pipeline:

1. **Build**: Docker image built and pushed to registry
2. **Test**: Automated tests run in CI environment
3. **Deploy**: Automatic deployment to staging/production
4. **Monitor**: Health checks and monitoring validation

See `.github/workflows/ci-cd.yml` for complete pipeline configuration.