# Library Service Kubernetes Deployment

This directory contains Kubernetes manifests for deploying the Library Service in a production-ready configuration.

> **Note**: This is one of two deployment options available. For simpler deployments, you can also use Docker Compose files in the parent directory. See [MIGRATION.md](./MIGRATION.md) for guidance on choosing the right deployment method.

## Prerequisites

- Kubernetes cluster (v1.20+)
- kubectl configured to access your cluster
- PostgreSQL and Redis services deployed (or external instances)
- Ingress controller (nginx, traefik, etc.)
- Monitoring stack (Prometheus, Grafana) - optional

## Quick Start

1. **Update Configuration**
   ```bash
   # Update the image registry in deployment.yaml
   sed -i 's|your-registry/library-service:latest|your-actual-registry/library-service:v1.0.0|g' deployment.yaml
   
   # Update secrets with actual base64 encoded values
   kubectl create secret generic library-service-secrets \
     --from-literal=DATABASE_USERNAME=library_user \
     --from-literal=DATABASE_PASSWORD=your-secure-password \
     --from-literal=JWT_SECRET=your-jwt-secret \
     --from-literal=REDIS_PASSWORD=your-redis-password \
     --from-literal=API_KEY=your-api-key
   ```

2. **Deploy using kubectl**
   ```bash
   kubectl apply -f .
   ```

3. **Deploy using kustomize**
   ```bash
   kubectl apply -k .
   ```

## Configuration Files

### Core Resources
- `deployment.yaml` - Main application deployment with health checks and security
- `service.yaml` - ClusterIP service for internal communication
- `configmap.yaml` - Non-sensitive configuration
- `secret.yaml` - Sensitive configuration (template)

### Storage
- `pvc.yaml` - Persistent Volume Claims for PostgreSQL and Redis data

### Scaling & Availability
- `hpa.yaml` - Horizontal Pod Autoscaler (2-10 replicas)
- `poddisruptionbudget.yaml` - Ensures minimum availability during updates

### Security
- `serviceaccount.yaml` - Service account with minimal RBAC permissions
- `networkpolicy.yaml` - Network isolation and traffic rules

### Management
- `kustomization.yaml` - Kustomize configuration for easy deployment management

## Health Checks

The deployment includes three types of health checks:

1. **Startup Probe** - Ensures the application starts within 150 seconds
2. **Readiness Probe** - Checks if the service is ready to receive traffic
3. **Liveness Probe** - Monitors if the service is healthy and restarts if needed

All probes use the `/health` endpoint with appropriate timeouts and thresholds.

## Autoscaling

The HPA is configured to:
- Maintain 2-10 replicas based on CPU (70%) and memory (80%) usage
- Scale up aggressively (100% increase every 30s)
- Scale down conservatively (50% decrease every 60s with 5min stabilization)

## Resource Requirements

### Per Pod:
- **Requests**: 250m CPU, 256Mi memory
- **Limits**: 500m CPU, 512Mi memory

### Storage:
- **PostgreSQL**: 10Gi persistent storage
- **Redis**: 2Gi persistent storage

## Security Features

- Non-root container execution (UID 1000)
- Read-only root filesystem
- No privilege escalation
- Dropped all capabilities
- Network policies for traffic isolation
- Service account with minimal RBAC

## Monitoring

The deployment is configured for Prometheus monitoring:
- Metrics endpoint: `/metrics`
- Annotations for automatic discovery
- Custom labels for service identification

## Environment-Specific Deployment

### Development
```bash
kubectl apply -k overlays/dev/
```

### Staging
```bash
kubectl apply -k overlays/staging/
```

### Production
```bash
kubectl apply -k overlays/prod/
```

## Troubleshooting

### Check Pod Status
```bash
kubectl get pods -l app=library-service
kubectl describe pod <pod-name>
kubectl logs <pod-name> -f
```

### Check Service Connectivity
```bash
kubectl get svc library-service
kubectl port-forward svc/library-service 8080:80
curl http://localhost:8080/health
```

### Check Autoscaling
```bash
kubectl get hpa library-service-hpa
kubectl describe hpa library-service-hpa
```

### Check Network Policies
```bash
kubectl get networkpolicy library-service-netpol
kubectl describe networkpolicy library-service-netpol
```

## Performance Tuning

### Database Connections
Adjust in configmap.yaml:
- `DATABASE_POOL_SIZE`: Connection pool size
- `DATABASE_CONNECTION_TIMEOUT`: Connection timeout
- `DATABASE_IDLE_TIMEOUT`: Idle connection timeout

### Cache Settings
Adjust in configmap.yaml:
- `CACHE_TTL`: Cache time-to-live
- `CACHE_MAX_ITEMS`: Maximum cached items
- `REDIS_COMMAND_TIMEOUT`: Redis command timeout

### API Limits
Adjust in configmap.yaml:
- `API_RATE_LIMIT`: Requests per window
- `API_RATE_WINDOW`: Rate limiting window
- `MAX_CONCURRENT_REQUESTS`: Maximum concurrent requests

## Backup and Recovery

### Database Backup
```bash
kubectl exec -it postgres-pod -- pg_dump library_service > backup.sql
```

### Configuration Backup
```bash
kubectl get configmap library-service-config -o yaml > config-backup.yaml
kubectl get secret library-service-secrets -o yaml > secrets-backup.yaml
```

## Updates and Rollbacks

### Rolling Update
```bash
kubectl set image deployment/library-service library-service=your-registry/library-service:v1.1.0
kubectl rollout status deployment/library-service
```

### Rollback
```bash
kubectl rollout undo deployment/library-service
kubectl rollout history deployment/library-service
```

## Support

For issues and questions:
1. Check the application logs
2. Verify health check endpoints
3. Check resource usage and limits
4. Review network connectivity
5. Consult the troubleshooting section above