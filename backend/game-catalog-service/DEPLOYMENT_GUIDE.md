# Game Catalog Service - Production Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Game Catalog Service to production environments, including Docker, Kubernetes, and cloud platforms.

## Prerequisites

### Infrastructure Requirements
- **Kubernetes Cluster**: v1.20+ with RBAC enabled
- **PostgreSQL Database**: v14+ with connection pooling
- **Redis Cache**: v6+ with persistence enabled
- **Container Registry**: Docker Hub, AWS ECR, or similar
- **Load Balancer**: NGINX, AWS ALB, or cloud provider LB
- **Monitoring**: Prometheus + Grafana (recommended)

### Access Requirements
- Kubernetes cluster admin access
- Container registry push permissions
- Database admin credentials
- DNS management access (for custom domains)

## Pre-Deployment Checklist

### 1. Environment Preparation
- [ ] Kubernetes cluster is running and accessible
- [ ] PostgreSQL database is provisioned and accessible
- [ ] Redis cache is provisioned and accessible
- [ ] Container registry is accessible
- [ ] SSL certificates are available (if using HTTPS)
- [ ] DNS records are configured

### 2. Security Setup
- [ ] Database credentials are secured
- [ ] JWT secrets are generated
- [ ] Network policies are configured
- [ ] RBAC permissions are set
- [ ] Security scanning is completed

### 3. Configuration Validation
- [ ] Environment variables are defined
- [ ] Resource limits are set appropriately
- [ ] Health check endpoints are configured
- [ ] Monitoring is set up
- [ ] Backup procedures are in place

## Deployment Methods

## Method 1: Docker Deployment

### 1. Build and Push Docker Image

```bash
# Build the production image
docker build -t game-catalog-service:v1.0.0 .

# Tag for registry
docker tag game-catalog-service:v1.0.0 your-registry/game-catalog-service:v1.0.0
docker tag game-catalog-service:v1.0.0 your-registry/game-catalog-service:latest

# Push to registry
docker push your-registry/game-catalog-service:v1.0.0
docker push your-registry/game-catalog-service:latest
```

### 2. Run with Docker Compose (Production)

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  game-catalog-service:
    image: your-registry/game-catalog-service:v1.0.0
    container_name: game-catalog-service-prod
    restart: unless-stopped
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - PORT=3002
      - POSTGRES_HOST=your-db-host
      - POSTGRES_PORT=5432
      - POSTGRES_USER=your-db-user
      - POSTGRES_PASSWORD=your-db-password
      - POSTGRES_DB=game_catalog_db
      - REDIS_HOST=your-redis-host
      - REDIS_PORT=6379
      - JWT_SECRET=your-jwt-secret
      - LOG_LEVEL=info
      - SWAGGER_ENABLED=false
    healthcheck:
      test: ["CMD", "node", "dist/src/health-check.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - app-network
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:14-alpine
    container_name: postgres-prod
    restart: unless-stopped
    environment:
      - POSTGRES_DB=game_catalog_db
      - POSTGRES_USER=your-db-user
      - POSTGRES_PASSWORD=your-db-password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network

  redis:
    image: redis:6-alpine
    container_name: redis-prod
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    container_name: nginx-prod
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    networks:
      - app-network
    depends_on:
      - game-catalog-service

volumes:
  postgres_data:
  redis_data:

networks:
  app-network:
    driver: bridge
```

### 3. Deploy with Docker Compose

```bash
# Deploy to production
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f game-catalog-service

# Update service
docker-compose -f docker-compose.prod.yml pull game-catalog-service
docker-compose -f docker-compose.prod.yml up -d game-catalog-service
```

## Method 2: Kubernetes Deployment

### 1. Create Kubernetes Manifests

#### Namespace
```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: gaming-platform
  labels:
    name: gaming-platform
```

#### ConfigMap
```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: game-catalog-config
  namespace: gaming-platform
data:
  NODE_ENV: "production"
  PORT: "3002"
  POSTGRES_HOST: "postgres-service"
  POSTGRES_PORT: "5432"
  POSTGRES_DB: "game_catalog_db"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
  LOG_LEVEL: "info"
  SWAGGER_ENABLED: "false"
  CACHE_TTL: "600"
  API_PREFIX: "api"
  HEALTH_CHECK_ENABLED: "true"
  METRICS_ENABLED: "true"
```

#### Secrets
```yaml
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: game-catalog-secrets
  namespace: gaming-platform
type: Opaque
data:
  POSTGRES_USER: <base64-encoded-username>
  POSTGRES_PASSWORD: <base64-encoded-password>
  JWT_SECRET: <base64-encoded-jwt-secret>
  REDIS_PASSWORD: <base64-encoded-redis-password>
```

#### Deployment
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: game-catalog-service
  namespace: gaming-platform
  labels:
    app: game-catalog-service
    version: v1.0.0
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: game-catalog-service
  template:
    metadata:
      labels:
        app: game-catalog-service
        version: v1.0.0
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3002"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: game-catalog-service
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: game-catalog-service
        image: your-registry/game-catalog-service:v1.0.0
        imagePullPolicy: Always
        ports:
        - name: http
          containerPort: 3002
          protocol: TCP
        - name: metrics
          containerPort: 9090
          protocol: TCP
        envFrom:
        - configMapRef:
            name: game-catalog-config
        - secretRef:
            name: game-catalog-secrets
        livenessProbe:
          httpGet:
            path: /api/v1/health/live
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/v1/health/ready
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /api/v1/health
            port: http
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: cache
          mountPath: /usr/src/app/.cache
      volumes:
      - name: tmp
        emptyDir: {}
      - name: cache
        emptyDir: {}
      nodeSelector:
        kubernetes.io/os: linux
      tolerations:
      - key: "node.kubernetes.io/not-ready"
        operator: "Exists"
        effect: "NoExecute"
        tolerationSeconds: 300
      - key: "node.kubernetes.io/unreachable"
        operator: "Exists"
        effect: "NoExecute"
        tolerationSeconds: 300
```

#### Service
```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: game-catalog-service
  namespace: gaming-platform
  labels:
    app: game-catalog-service
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "3002"
    prometheus.io/path: "/metrics"
spec:
  type: ClusterIP
  ports:
  - name: http
    port: 80
    targetPort: http
    protocol: TCP
  - name: metrics
    port: 9090
    targetPort: metrics
    protocol: TCP
  selector:
    app: game-catalog-service
```

#### Ingress
```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: game-catalog-ingress
  namespace: gaming-platform
  annotations:
    kubernetes.io/ingress.class: "nginx"
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - api.gaming-platform.ru
    secretName: game-catalog-tls
  rules:
  - host: api.gaming-platform.ru
    http:
      paths:
      - path: /catalog
        pathType: Prefix
        backend:
          service:
            name: game-catalog-service
            port:
              number: 80
```

#### HorizontalPodAutoscaler
```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: game-catalog-hpa
  namespace: gaming-platform
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: game-catalog-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

### 2. Deploy to Kubernetes

```bash
# Create namespace
kubectl apply -f namespace.yaml

# Create secrets (encode values first)
echo -n 'your-username' | base64
echo -n 'your-password' | base64
echo -n 'your-jwt-secret' | base64
kubectl apply -f secrets.yaml

# Deploy configuration
kubectl apply -f configmap.yaml

# Deploy application
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml

# Verify deployment
kubectl get pods -n gaming-platform
kubectl get services -n gaming-platform
kubectl get ingress -n gaming-platform

# Check logs
kubectl logs -f deployment/game-catalog-service -n gaming-platform

# Check health
kubectl port-forward service/game-catalog-service 3002:80 -n gaming-platform
curl http://localhost:3002/api/v1/health
```

## Method 3: Cloud Platform Deployment

### AWS EKS Deployment

#### 1. Prerequisites
```bash
# Install AWS CLI and eksctl
aws configure
eksctl version

# Create EKS cluster
eksctl create cluster \
  --name gaming-platform \
  --version 1.24 \
  --region us-west-2 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 1 \
  --nodes-max 4 \
  --managed
```

#### 2. Deploy with Helm (Recommended)

Create `helm/values.yaml`:
```yaml
replicaCount: 3

image:
  repository: your-account.dkr.ecr.us-west-2.amazonaws.com/game-catalog-service
  tag: v1.0.0
  pullPolicy: Always

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: true
  className: "alb"
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:us-west-2:123456789:certificate/your-cert
  hosts:
    - host: api.gaming-platform.com
      paths:
        - path: /catalog
          pathType: Prefix

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

env:
  NODE_ENV: production
  POSTGRES_HOST: your-rds-endpoint
  REDIS_HOST: your-elasticache-endpoint

secrets:
  POSTGRES_USER: your-db-user
  POSTGRES_PASSWORD: your-db-password
  JWT_SECRET: your-jwt-secret
```

Deploy with Helm:
```bash
# Add Helm chart
helm create game-catalog-service

# Deploy
helm install game-catalog-service ./helm \
  --namespace gaming-platform \
  --create-namespace \
  --values helm/values.yaml

# Upgrade
helm upgrade game-catalog-service ./helm \
  --namespace gaming-platform \
  --values helm/values.yaml
```

### Google GKE Deployment

```bash
# Create GKE cluster
gcloud container clusters create gaming-platform \
  --zone us-central1-a \
  --num-nodes 3 \
  --enable-autoscaling \
  --min-nodes 1 \
  --max-nodes 10 \
  --machine-type n1-standard-2

# Get credentials
gcloud container clusters get-credentials gaming-platform --zone us-central1-a

# Deploy using kubectl
kubectl apply -f k8s/
```

## Database Setup

### 1. PostgreSQL Configuration

```sql
-- Create database and user
CREATE DATABASE game_catalog_db;
CREATE USER game_catalog_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE game_catalog_db TO game_catalog_user;

-- Connect to the database
\c game_catalog_db;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO game_catalog_user;
```

### 2. Run Database Migrations

```bash
# From the application container or pod
npm run migration:run

# Or using kubectl
kubectl exec -it deployment/game-catalog-service -n gaming-platform -- npm run migration:run
```

### 3. Seed Initial Data (Optional)

```bash
# Run data seeding
kubectl exec -it deployment/game-catalog-service -n gaming-platform -- npm run db:seed
```

## Monitoring Setup

### 1. Prometheus Configuration

```yaml
# prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
    scrape_configs:
    - job_name: 'game-catalog-service'
      kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
          - gaming-platform
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
```

### 2. Grafana Dashboard

Import the provided Grafana dashboard JSON or create custom dashboards for:
- Request rate and latency
- Error rates
- Database connection pool
- Cache hit rates
- Memory and CPU usage

## SSL/TLS Configuration

### 1. Using cert-manager (Recommended)

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.11.0/cert-manager.yaml

# Create ClusterIssuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@gaming-platform.ru
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### 2. Manual Certificate Setup

```bash
# Create TLS secret
kubectl create secret tls game-catalog-tls \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key \
  --namespace gaming-platform
```

## Backup and Disaster Recovery

### 1. Database Backup

```bash
# Create backup job
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: gaming-platform
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: postgres-backup
            image: postgres:14
            command:
            - /bin/bash
            - -c
            - |
              pg_dump -h \$POSTGRES_HOST -U \$POSTGRES_USER \$POSTGRES_DB > /backup/backup-\$(date +%Y%m%d-%H%M%S).sql
              aws s3 cp /backup/backup-\$(date +%Y%m%d-%H%M%S).sql s3://your-backup-bucket/
            env:
            - name: POSTGRES_HOST
              value: "postgres-service"
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: game-catalog-secrets
                  key: POSTGRES_USER
            - name: POSTGRES_DB
              value: "game_catalog_db"
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: game-catalog-secrets
                  key: POSTGRES_PASSWORD
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            emptyDir: {}
          restartPolicy: OnFailure
EOF
```

### 2. Application State Backup

```bash
# Backup Redis data
kubectl exec -it redis-pod -- redis-cli BGSAVE
kubectl cp redis-pod:/data/dump.rdb ./redis-backup-$(date +%Y%m%d).rdb
```

## Performance Tuning

### 1. Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX CONCURRENTLY idx_games_title_search ON games USING gin(to_tsvector('russian', title));
CREATE INDEX CONCURRENTLY idx_games_available ON games(available) WHERE available = true;
CREATE INDEX CONCURRENTLY idx_games_genre ON games(genre);
CREATE INDEX CONCURRENTLY idx_games_price ON games(price);
CREATE INDEX CONCURRENTLY idx_games_created_at ON games(created_at);

-- Update table statistics
ANALYZE games;
```

### 2. Redis Configuration

```bash
# Optimize Redis for caching
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET save "900 1 300 10 60 10000"
```

### 3. Application Tuning

Update deployment with optimized settings:
```yaml
env:
- name: NODE_OPTIONS
  value: "--max-old-space-size=512"
- name: POSTGRES_MAX_CONNECTIONS
  value: "50"
- name: CACHE_TTL
  value: "600"
```

## Security Hardening

### 1. Network Policies

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: game-catalog-network-policy
  namespace: gaming-platform
spec:
  podSelector:
    matchLabels:
      app: game-catalog-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3002
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: database
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - namespaceSelector:
        matchLabels:
          name: cache
    ports:
    - protocol: TCP
      port: 6379
```

### 2. Pod Security Policy

```yaml
# pod-security-policy.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: game-catalog-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

## Troubleshooting

### Common Issues

1. **Pod Startup Issues**
```bash
# Check pod status
kubectl get pods -n gaming-platform
kubectl describe pod <pod-name> -n gaming-platform
kubectl logs <pod-name> -n gaming-platform

# Check events
kubectl get events -n gaming-platform --sort-by='.lastTimestamp'
```

2. **Database Connection Issues**
```bash
# Test database connectivity
kubectl exec -it deployment/game-catalog-service -n gaming-platform -- npm run test:db

# Check database logs
kubectl logs postgres-pod -n gaming-platform
```

3. **Performance Issues**
```bash
# Check resource usage
kubectl top pods -n gaming-platform
kubectl top nodes

# Check HPA status
kubectl get hpa -n gaming-platform
kubectl describe hpa game-catalog-hpa -n gaming-platform
```

### Rollback Procedures

```bash
# Rollback deployment
kubectl rollout undo deployment/game-catalog-service -n gaming-platform

# Rollback to specific revision
kubectl rollout undo deployment/game-catalog-service --to-revision=2 -n gaming-platform

# Check rollout status
kubectl rollout status deployment/game-catalog-service -n gaming-platform
```

## Maintenance

### 1. Regular Updates

```bash
# Update application
docker build -t game-catalog-service:v1.0.1 .
docker push your-registry/game-catalog-service:v1.0.1

# Update Kubernetes deployment
kubectl set image deployment/game-catalog-service \
  game-catalog-service=your-registry/game-catalog-service:v1.0.1 \
  -n gaming-platform

# Monitor rollout
kubectl rollout status deployment/game-catalog-service -n gaming-platform
```

### 2. Database Maintenance

```bash
# Run database maintenance
kubectl exec -it postgres-pod -n gaming-platform -- psql -U postgres -d game_catalog_db -c "VACUUM ANALYZE;"

# Update statistics
kubectl exec -it postgres-pod -n gaming-platform -- psql -U postgres -d game_catalog_db -c "ANALYZE;"
```

### 3. Cache Maintenance

```bash
# Clear Redis cache if needed
kubectl exec -it redis-pod -n gaming-platform -- redis-cli FLUSHALL

# Check Redis memory usage
kubectl exec -it redis-pod -n gaming-platform -- redis-cli INFO memory
```

## Support and Monitoring

### Health Check URLs
- **Comprehensive Health**: `https://api.gaming-platform.ru/catalog/api/v1/health`
- **Readiness**: `https://api.gaming-platform.ru/catalog/api/v1/health/ready`
- **Liveness**: `https://api.gaming-platform.ru/catalog/api/v1/health/live`

### Monitoring Dashboards
- **Grafana**: `https://monitoring.gaming-platform.ru/grafana`
- **Prometheus**: `https://monitoring.gaming-platform.ru/prometheus`
- **Kubernetes Dashboard**: `https://k8s.gaming-platform.ru`

### Log Aggregation
- **ELK Stack**: `https://logs.gaming-platform.ru`
- **Fluentd**: Configured for log collection
- **Kibana**: Dashboard for log analysis

---

**Game Catalog Service - Production Deployment Guide v1.0.0**