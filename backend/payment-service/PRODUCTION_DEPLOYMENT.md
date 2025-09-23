# Payment Service - Production Deployment Guide

## Overview

This guide covers the complete production deployment of the Payment Service, including infrastructure setup, monitoring, and load testing procedures.

## Prerequisites

- Kubernetes cluster (v1.24+)
- Prometheus and Grafana for monitoring
- PostgreSQL database
- Redis cache
- Docker registry access
- Artillery for load testing

## Deployment Steps

### 1. Build and Push Docker Image

```bash
# Build optimized production image
docker build -t your-registry/payment-service:1.0.0 .

# Push to registry
docker push your-registry/payment-service:1.0.0
```

### 2. Deploy to Kubernetes

```bash
# Apply all Kubernetes manifests
kubectl apply -f k8s/

# Verify deployment
kubectl get pods -l app=payment-service
kubectl get svc payment-service
```

### 3. Configure Monitoring

```bash
# Apply Prometheus rules
kubectl apply -f monitoring/prometheus-rules.yaml

# Import Grafana dashboard
# Upload monitoring/grafana-dashboard.json to Grafana
```

### 4. Run Load Tests

```bash
# Run comprehensive load tests
cd load-test
./run-load-test.sh

# Or on Windows
powershell -ExecutionPolicy Bypass -File run-load-test.ps1
```

## Production Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Service port | `3005` |
| `POSTGRES_HOST` | Database host | `payment-postgres` |
| `POSTGRES_PORT` | Database port | `5432` |
| `POSTGRES_USERNAME` | Database user | `payments` |
| `POSTGRES_PASSWORD` | Database password | `secure_password` |
| `POSTGRES_DATABASE` | Database name | `payments` |
| `REDIS_HOST` | Redis host | `redis-master` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | `secure_redis_password` |
| `JWT_SECRET` | JWT secret key | `production_jwt_secret` |

### Resource Requirements

#### Minimum Requirements
- **CPU**: 200m (0.2 cores)
- **Memory**: 256Mi
- **Storage**: 1Gi ephemeral

#### Recommended Production
- **CPU**: 500m-1000m (0.5-1 cores)
- **Memory**: 512Mi-1Gi
- **Storage**: 2Gi ephemeral

### Scaling Configuration

#### Horizontal Pod Autoscaler (HPA)
- **Min Replicas**: 3
- **Max Replicas**: 20
- **CPU Target**: 70%
- **Memory Target**: 80%

#### Pod Disruption Budget (PDB)
- **Min Available**: 2 pods
- Ensures high availability during updates

## Monitoring and Alerting

### Key Metrics

#### Payment Metrics
- `payments_total` - Total payments processed
- `payment_duration_seconds` - Payment processing time
- `payment_amount_histogram` - Payment amount distribution
- `active_payments_gauge` - Currently active payments

#### System Metrics
- CPU and memory usage
- Request rate and latency
- Error rates by provider
- Integration health

### Critical Alerts

#### High Priority
- Payment error rate > 5%
- Payment processing time > 2s (P95)
- No payments received for 15 minutes
- Provider error rate > 80%

#### Medium Priority
- High memory/CPU usage
- Integration failures
- Webhook processing errors

### Grafana Dashboard

The production dashboard includes:
- Payment success rate and volume
- Latency percentiles (P50, P95, P99)
- Provider performance comparison
- Integration health status
- Resource utilization
- Error rate trends

## Load Testing Results

### Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| Concurrent Users | 1000+ | ✅ Tested |
| P95 Response Time | < 2000ms | ✅ Achieved |
| Error Rate | < 1% | ✅ Achieved |
| Throughput | 500+ RPS | ✅ Achieved |

### Test Scenarios

1. **Complete Payment Flow** (70% traffic)
   - Create order → Create payment → Confirm payment
   - Realistic user behavior simulation

2. **Order Status Checks** (15% traffic)
   - Frequent status polling
   - Pagination testing

3. **Payment Cancellations** (10% traffic)
   - Cancellation flow testing
   - Error handling validation

4. **Health Checks** (5% traffic)
   - Monitoring endpoint validation
   - Service availability testing

## Security Considerations

### Network Security
- NetworkPolicy restricts ingress/egress traffic
- TLS encryption for all external communications
- Service mesh integration (if available)

### Application Security
- JWT token validation
- Input validation and sanitization
- SQL injection prevention
- Rate limiting and throttling

### Data Security
- Sensitive data in Kubernetes Secrets
- Database encryption at rest
- Audit logging for all payment operations
- PCI DSS compliance considerations

## Troubleshooting

### Common Issues

#### High Error Rate
1. Check provider status
2. Verify database connectivity
3. Review integration health
4. Check resource limits

#### High Latency
1. Monitor database performance
2. Check Redis cache hit rate
3. Review provider response times
4. Analyze resource utilization

#### Integration Failures
1. Verify service discovery
2. Check network policies
3. Review authentication tokens
4. Monitor external service health

### Debugging Commands

```bash
# Check pod status
kubectl get pods -l app=payment-service

# View logs
kubectl logs -l app=payment-service --tail=100

# Check metrics
kubectl port-forward svc/payment-service 3005:80
curl http://localhost:3005/metrics

# Check health
curl http://localhost:3005/health
```

## Maintenance

### Regular Tasks

#### Daily
- Monitor error rates and latency
- Check resource utilization
- Review security alerts

#### Weekly
- Analyze payment trends
- Review provider performance
- Update dependencies (if needed)

#### Monthly
- Run comprehensive load tests
- Review and update monitoring rules
- Security audit and compliance check

### Backup and Recovery

#### Database Backups
- Automated daily backups
- Point-in-time recovery capability
- Cross-region backup replication

#### Configuration Backups
- Kubernetes manifests in version control
- Environment configuration backup
- Monitoring configuration backup

## Performance Optimization

### Database Optimization
- Connection pooling configuration
- Query optimization and indexing
- Read replica for analytics queries

### Caching Strategy
- Redis for payment status caching
- Application-level caching for static data
- CDN for static assets (if applicable)

### Application Optimization
- Async processing for non-critical operations
- Circuit breakers for external integrations
- Request/response compression

## Compliance and Auditing

### Audit Logging
- All payment operations logged
- Structured logging with correlation IDs
- Centralized log aggregation
- Long-term log retention

### Compliance Requirements
- PCI DSS considerations for payment data
- GDPR compliance for user data
- Russian data localization requirements
- Financial regulations compliance

## Support and Escalation

### On-Call Procedures
1. Monitor alerts in Slack/PagerDuty
2. Check Grafana dashboard for context
3. Review recent deployments
4. Escalate to senior engineer if needed

### Contact Information
- **Primary On-Call**: Payment Team
- **Secondary**: Platform Team
- **Escalation**: Engineering Manager

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01-XX | Initial production deployment |
| 1.0.1 | 2024-01-XX | Enhanced monitoring and alerting |
| 1.1.0 | 2024-02-XX | Added new payment providers |