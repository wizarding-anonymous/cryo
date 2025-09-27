# Production Deployment Guide

This guide covers the production deployment of the Review Service for the Russian gaming platform MVP.

## Prerequisites

### Required Tools
- Docker (for building images)
- kubectl (for Kubernetes deployment)
- k6 (for load testing)
- Access to Kubernetes cluster
- Container registry access

### Environment Setup
1. Configure kubectl to connect to your Kubernetes cluster
2. Ensure Docker is running and you're logged into your container registry
3. Install k6 for load testing: https://k6.io/docs/getting-started/installation/

## Deployment Architecture

The Review Service is deployed with the following components:

- **Deployment**: 3 replicas with auto-scaling (3-10 pods)
- **Service**: ClusterIP service for internal communication
- **ConfigMap**: Environment configuration
- **Secret**: Sensitive data (passwords, JWT secrets)
- **HPA**: Horizontal Pod Autoscaler for load-based scaling
- **ServiceMonitor**: Prometheus monitoring integration

## Configuration

### 1. Update Secrets
Edit `k8s/secret.yaml` and replace base64 encoded values:

```bash
# Encode your actual passwords
echo -n "your-db-password" | base64
echo -n "your-jwt-secret" | base64
```

### 2. Update ConfigMap
Edit `k8s/configmap.yaml` to match your environment:

- Database connection details
- External service URLs
- Performance settings

### 3. Update Image Registry
Update the registry URL in deployment scripts:

```bash
# For bash script
export REGISTRY="your-registry.com"

# For PowerShell script
$Registry = "your-registry.com"
```

## Deployment Methods

### Method 1: Automated Script (Recommended)

#### Linux/macOS
```bash
# Basic deployment
./scripts/deploy.sh

# With specific image tag
./scripts/deploy.sh v1.2.3

# With load testing
RUN_LOAD_TEST=true ./scripts/deploy.sh
```

#### Windows (PowerShell)
```powershell
# Basic deployment
.\scripts\deploy.ps1

# With specific image tag
.\scripts\deploy.ps1 -ImageTag "v1.2.3"

# With load testing
.\scripts\deploy.ps1 -RunLoadTest
```

### Method 2: Manual Deployment

1. **Build and Push Image**
```bash
docker build -t your-registry.com/review-service:latest --target production .
docker push your-registry.com/review-service:latest
```

2. **Deploy to Kubernetes**
```bash
kubectl create namespace review-service
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/hpa.yaml
```

3. **Wait for Deployment**
```bash
kubectl rollout status deployment/review-service -n review-service
```

## Health Checks

The service provides multiple health check endpoints:

- `/health` - Basic health check
- `/health/detailed` - Detailed health with service integrations
- `/health/readiness` - Kubernetes readiness probe
- `/health/liveness` - Kubernetes liveness probe

### Manual Health Check
```bash
kubectl port-forward service/review-service 8080:3004 -n review-service
curl http://localhost:8080/health/detailed
```

## Monitoring

### Service Integration Monitoring
The service automatically monitors external service integrations:

- Library Service (ownership verification)
- Notification Service (review notifications)
- Game Catalog Service (rating updates)
- Achievement Service (review achievements)

Access monitoring data:
```bash
kubectl port-forward service/review-service 8080:3004 -n review-service
curl http://localhost:8080/monitoring/services
```

### Prometheus Metrics
If Prometheus is deployed, the ServiceMonitor will automatically configure scraping:

- Service health metrics
- Response time metrics
- Error rate metrics
- Integration status metrics

## Load Testing

### Prerequisites
Install k6: https://k6.io/docs/getting-started/installation/

### Running Load Tests

#### Local Testing
```bash
cd load-test
npm run test:local
```

#### Production Testing
```bash
cd load-test
BASE_URL=http://your-service-url k6 run load-test.js
```

### Load Test Scenarios
The load test simulates 1000 concurrent users with:
- 40% creating reviews
- 30% reading game reviews
- 20% getting game ratings
- 10% health checks

### Performance Targets
- **Response Time**: 95% < 200ms
- **Error Rate**: < 10%
- **Throughput**: 1000+ concurrent users

## Scaling

### Horizontal Pod Autoscaler
The HPA automatically scales based on:
- CPU utilization (target: 70%)
- Memory utilization (target: 80%)
- Min replicas: 3
- Max replicas: 10

### Manual Scaling
```bash
kubectl scale deployment review-service --replicas=5 -n review-service
```

## Troubleshooting

### Common Issues

#### 1. Pod Not Starting
```bash
kubectl describe pod -l app=review-service -n review-service
kubectl logs -l app=review-service -n review-service
```

#### 2. Database Connection Issues
Check database connectivity and credentials:
```bash
kubectl exec -it deployment/review-service -n review-service -- sh
# Inside pod: test database connection
```

#### 3. External Service Integration Issues
Check service health:
```bash
curl http://localhost:8080/health/detailed
curl http://localhost:8080/monitoring/services
```

#### 4. Performance Issues
Monitor resource usage:
```bash
kubectl top pods -n review-service
kubectl describe hpa review-service-hpa -n review-service
```

### Logs
```bash
# Real-time logs
kubectl logs -f deployment/review-service -n review-service

# Logs from all pods
kubectl logs -l app=review-service -n review-service --tail=100
```

## Rollback

### Rollback to Previous Version
```bash
kubectl rollout undo deployment/review-service -n review-service
```

### Rollback to Specific Revision
```bash
kubectl rollout history deployment/review-service -n review-service
kubectl rollout undo deployment/review-service --to-revision=2 -n review-service
```

## Security Considerations

1. **Secrets Management**: Use Kubernetes secrets or external secret management
2. **Network Policies**: Implement network policies to restrict pod communication
3. **RBAC**: Configure proper role-based access control
4. **Image Security**: Scan images for vulnerabilities before deployment
5. **TLS**: Enable TLS for all external communications

## Maintenance

### Regular Tasks
1. **Update Dependencies**: Regularly update npm packages and base images
2. **Security Patches**: Apply security patches promptly
3. **Performance Monitoring**: Monitor and optimize performance metrics
4. **Backup**: Ensure database backups are configured
5. **Log Rotation**: Configure log rotation to prevent disk space issues

### Scheduled Maintenance
```bash
# Restart deployment (rolling restart)
kubectl rollout restart deployment/review-service -n review-service

# Update image
kubectl set image deployment/review-service review-service=your-registry.com/review-service:new-tag -n review-service
```

## Support

For deployment issues:
1. Check logs and monitoring endpoints
2. Verify external service connectivity
3. Review resource utilization
4. Check Kubernetes events
5. Contact the development team with detailed error information