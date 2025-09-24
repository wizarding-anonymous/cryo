# Download Service - Production Deployment Guide

## Overview

This guide covers the production deployment of the Download Service, including performance optimization, monitoring, and load testing procedures.

## Production Readiness Checklist

### ✅ Infrastructure
- [x] Optimized Alpine Linux Docker image with multi-stage build
- [x] Kubernetes manifests with resource limits and security policies
- [x] Horizontal Pod Autoscaler (HPA) configuration
- [x] Pod Disruption Budget (PDB) for high availability
- [x] Network policies for security isolation
- [x] Health checks and readiness probes

### ✅ Monitoring & Observability
- [x] Prometheus metrics for performance monitoring
- [x] Grafana dashboard for real-time monitoring
- [x] Alerting rules for critical issues
- [x] Service monitor for automatic metric collection
- [x] pprof profiling endpoints for performance analysis

### ✅ Performance & Load Testing
- [x] Comprehensive benchmark tests
- [x] Load testing scripts for API endpoints
- [x] File operations stress testing
- [x] Concurrent operations testing (1000+ simultaneous downloads)
- [x] Memory and CPU profiling capabilities

## Deployment Instructions

### 1. Pre-deployment Checks

Run the production readiness check:
```bash
make prod-check
```

This will:
- Run all tests with coverage report
- Execute load tests
- Perform security scans (if tools available)
- Check for vulnerabilities

### 2. Build and Push Docker Image

```bash
# Build optimized production image
make docker-build

# Push to registry (interactive)
make docker-push
```

### 3. Deploy to Kubernetes

```bash
# Deploy all manifests
make k8s-deploy

# Or deploy individually
kubectl apply -f deploy/k8s/deployment.yaml
kubectl apply -f deploy/k8s/hpa.yaml
kubectl apply -f deploy/k8s/pdb.yaml
kubectl apply -f deploy/k8s/servicemonitor.yaml
kubectl apply -f deploy/k8s/networkpolicy.yaml
```

### 4. Deploy Monitoring

```bash
# Deploy Prometheus alerts
kubectl apply -f deploy/monitoring/prometheus-alerts.yaml

# Import Grafana dashboard
# Use deploy/monitoring/grafana-dashboard.json in Grafana UI
```

## Load Testing

### Comprehensive Load Testing

Run all load tests:
```bash
make load-test
```

### Specific Test Types

```bash
# API endpoint load testing
make load-test-api

# File operations load testing
make load-test-file-ops

# Stress testing (1000+ concurrent operations)
make stress-test

# Performance profiling
make profile
```

### Manual Load Testing

```bash
# Run custom load tests
cd scripts
go run load-test.go

# Run file operations stress test
go run file-operations-load-test.go

# Run comprehensive test suite
./run-load-tests.sh all
```

## Performance Optimization

### 1. CPU Profiling

```bash
# Generate CPU profile
make bench-cpu

# Analyze profile
go tool pprof cpu.prof
```

### 2. Memory Profiling

```bash
# Generate memory profile
make bench-mem

# Analyze profile
go tool pprof mem.prof
```

### 3. Live Profiling

Access pprof endpoints in production (if enabled):
```bash
# CPU profile
curl http://service-url/debug/pprof/profile?seconds=30 > cpu.prof

# Memory profile
curl http://service-url/debug/pprof/heap > mem.prof

# Goroutine profile
curl http://service-url/debug/pprof/goroutine > goroutine.prof
```

## Monitoring

### Key Metrics to Monitor

1. **Request Metrics**
   - `http_requests_total` - Total HTTP requests
   - `http_request_duration_seconds` - Request latency
   - `http_in_flight_requests` - Concurrent requests

2. **Download Metrics**
   - `downloads_total` - Total downloads by status
   - `downloads_active` - Active downloads count
   - `download_bytes_total` - Total bytes downloaded

3. **System Metrics**
   - `process_resident_memory_bytes` - Memory usage
   - `process_cpu_seconds_total` - CPU usage
   - `go_goroutines` - Goroutine count

### Grafana Dashboard

Import the dashboard from `deploy/monitoring/grafana-dashboard.json` to monitor:
- Request rate and response times
- Download success rates and throughput
- System resource usage
- Error rates and patterns

### Alerts

The following alerts are configured:
- High error rate (>5% for 2 minutes)
- High latency (>1s 95th percentile for 5 minutes)
- Service down (>1 minute)
- High memory usage (>90% for 5 minutes)
- High CPU usage (>80% for 5 minutes)
- Too many active downloads (>1000 for 2 minutes)
- Low success rate (<90% for 5 minutes)

## Scaling Configuration

### Horizontal Pod Autoscaler

The HPA is configured to scale based on:
- CPU utilization (target: 70%)
- Memory utilization (target: 80%)
- Active downloads (target: 50 per pod)

Scaling behavior:
- Min replicas: 2
- Max replicas: 20
- Scale up: 50% increase or 2 pods max per minute
- Scale down: 10% decrease per minute with 5-minute stabilization

### Resource Limits

Per pod resources:
- **Requests**: 100m CPU, 128Mi memory
- **Limits**: 500m CPU, 512Mi memory

## Security

### Network Policies

Network access is restricted to:
- Ingress: API Gateway, Monitoring systems
- Egress: PostgreSQL, Redis, Library Service, DNS, HTTPS

### Container Security

- Runs as non-root user (UID 65532)
- Read-only root filesystem
- No privilege escalation
- All capabilities dropped

## Troubleshooting

### Performance Issues

1. Check metrics in Grafana dashboard
2. Analyze CPU/memory profiles
3. Review application logs
4. Check database connection pool usage
5. Monitor Redis cache hit rates

### High Load Scenarios

1. Verify HPA is scaling appropriately
2. Check resource utilization
3. Monitor download success rates
4. Review error logs for patterns
5. Consider increasing resource limits

### Common Issues

1. **High Memory Usage**
   - Check for goroutine leaks
   - Review file handling operations
   - Monitor garbage collection metrics

2. **High CPU Usage**
   - Profile CPU usage patterns
   - Check for inefficient algorithms
   - Review concurrent operations

3. **Download Failures**
   - Check Library Service connectivity
   - Verify file storage accessibility
   - Review authentication issues

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review performance metrics
   - Check alert history
   - Update security patches

2. **Monthly**
   - Run comprehensive load tests
   - Review and update resource limits
   - Analyze performance trends

3. **Quarterly**
   - Security audit
   - Dependency updates
   - Performance optimization review

### Backup and Recovery

1. **Database Backups**
   - PostgreSQL automated backups
   - Point-in-time recovery capability

2. **Configuration Backups**
   - Kubernetes manifests in version control
   - Environment configurations documented

## Support

For production issues:
1. Check Grafana dashboard for immediate insights
2. Review Prometheus alerts for active issues
3. Analyze application logs
4. Use profiling tools for performance issues
5. Escalate to development team with metrics and logs