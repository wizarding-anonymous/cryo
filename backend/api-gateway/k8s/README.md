# API Gateway Kubernetes Deployment

This directory contains Kubernetes manifests for deploying the API Gateway service to a Kubernetes cluster.

## Overview

The API Gateway serves as the single entry point for the Cryo gaming platform, providing:
- Request routing to microservices
- JWT authentication
- Rate limiting
- Response standardization
- Health checks

## Architecture

```
Internet → Ingress → Service → Pods (2-10 replicas)
                              ↓
                           Redis Cache
                              ↓
                        Microservices
```

## Prerequisites

- Kubernetes cluster (v1.20+)
- kubectl configured to access the cluster
- NGINX Ingress Controller installed
- Redis service available in the cluster

## Quick Deployment

### Using the deployment script:

**Linux/macOS:**
```bash
cd backend/api-gateway/k8s
./deploy.sh
```

**Windows:**
```powershell
cd backend/api-gateway/k8s
./deploy.ps1
```

### Manual deployment:

```bash
# Apply all manifests
kubectl apply -k .

# Check deployment status
kubectl get all -n cryo -l app=api-gateway
```

## Manifests Description

### Core Resources

- **`namespace.yaml`** - Creates the `cryo` namespace
- **`configmap.yaml`** - Environment variables and configuration
- **`deployment.yaml`** - Main application deployment with health checks
- **`service.yaml`** - ClusterIP service for internal communication
- **`ingress.yaml`** - External access configuration with NGINX

### Scaling & Reliability

- **`hpa.yaml`** - Horizontal Pod Autoscaler (2-10 replicas)
- **`pdb.yaml`** - Pod Disruption Budget for high availability
- **`networkpolicy.yaml`** - Network security policies

### Monitoring

- **`servicemonitor.yaml`** - Prometheus monitoring configuration

### Deployment Management

- **`kustomization.yaml`** - Kustomize configuration for easy deployment
- **`deploy.sh`** / **`deploy.ps1`** - Automated deployment scripts

## Configuration

### Environment Variables

Key configuration options in `configmap.yaml`:

```yaml
# Performance settings for 1000+ concurrent users
NODE_ENV: "production"
PORT: "3001"
UV_THREADPOOL_SIZE: "16"
NODE_OPTIONS: "--max-old-space-size=768"

# Redis configuration
REDIS_HOST: "redis"
REDIS_PORT: "6379"

# Rate limiting
RATE_LIMIT_MAX_REQUESTS: "60"
RATE_LIMIT_WINDOW_MS: "60000"

# Service URLs
SERVICE_USER_BASE_URL: "http://user-service:3001"
SERVICE_GAME_CATALOG_BASE_URL: "http://game-catalog-service:3002"
# ... other services
```

### Resource Requirements

**Per Pod:**
- CPU: 200m request, 1000m limit
- Memory: 256Mi request, 1Gi limit

**Scaling:**
- Min replicas: 2
- Max replicas: 10
- Scale up on: 70% CPU or 80% memory
- Scale down: Gradual (10% every 60s)

## Health Checks

The deployment includes comprehensive health checks:

### Readiness Probe
- **Endpoint:** `/api/health`
- **Initial Delay:** 5 seconds
- **Period:** 10 seconds
- **Timeout:** 2 seconds
- **Failure Threshold:** 3

### Liveness Probe
- **Endpoint:** `/api/health`
- **Initial Delay:** 10 seconds
- **Period:** 15 seconds
- **Timeout:** 2 seconds
- **Failure Threshold:** 5

## Networking

### Ingress Configuration

- **Host:** `cryo.local` (configure for your domain)
- **Path:** `/api(/|$)(.*)`
- **Rate Limiting:** 100 requests per minute
- **CORS:** Enabled for all origins
- **Timeouts:** 60s read/send, 5s connect

### Network Policy

The NetworkPolicy restricts traffic to:
- **Ingress:** Only from ingress-nginx and cryo namespace
- **Egress:** DNS, Redis, and microservices only

## Monitoring

### Prometheus Metrics

The ServiceMonitor exposes metrics at `/api/metrics`:
- Request rates and latencies
- Error rates
- Health check status
- Resource utilization

### Logging

Logs are available via kubectl:
```bash
# View current logs
kubectl logs -f deployment/api-gateway -n cryo

# View logs from all pods
kubectl logs -f -l app=api-gateway -n cryo
```

## Troubleshooting

### Common Issues

1. **Pods not starting:**
   ```bash
   kubectl describe pods -l app=api-gateway -n cryo
   ```

2. **Health checks failing:**
   ```bash
   kubectl port-forward svc/api-gateway 3001:3001 -n cryo
   curl http://localhost:3001/api/health
   ```

3. **Service discovery issues:**
   ```bash
   kubectl get endpoints -n cryo
   ```

4. **Ingress not working:**
   ```bash
   kubectl describe ingress api-gateway -n cryo
   ```

### Performance Tuning

For higher loads (>1000 concurrent users):

1. **Increase resources:**
   ```yaml
   resources:
     requests:
       cpu: "500m"
       memory: "512Mi"
     limits:
       cpu: "2000m"
       memory: "2Gi"
   ```

2. **Adjust HPA:**
   ```yaml
   maxReplicas: 20
   targetCPUUtilizationPercentage: 50
   ```

3. **Tune Node.js:**
   ```yaml
   NODE_OPTIONS: "--max-old-space-size=1536"
   UV_THREADPOOL_SIZE: "32"
   ```

## Security

### Network Security
- NetworkPolicy restricts ingress/egress traffic
- Only necessary ports are exposed
- Inter-service communication is encrypted

### Application Security
- JWT token validation
- Rate limiting at ingress and application level
- Input validation and sanitization
- CORS protection

## Maintenance

### Updates

1. **Rolling update:**
   ```bash
   kubectl set image deployment/api-gateway api-gateway=cryo/api-gateway:new-version -n cryo
   ```

2. **Rollback:**
   ```bash
   kubectl rollout undo deployment/api-gateway -n cryo
   ```

### Scaling

1. **Manual scaling:**
   ```bash
   kubectl scale deployment api-gateway --replicas=5 -n cryo
   ```

2. **HPA status:**
   ```bash
   kubectl get hpa api-gateway -n cryo
   ```

## Production Checklist

- [ ] Configure proper domain in ingress
- [ ] Set up TLS certificates
- [ ] Configure resource limits based on load testing
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation
- [ ] Test disaster recovery procedures
- [ ] Validate security policies
- [ ] Performance test with 1000+ concurrent users