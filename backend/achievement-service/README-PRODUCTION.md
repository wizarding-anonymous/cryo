# Achievement Service - Production Deployment Guide

## Overview

This guide covers the production deployment and monitoring setup for the Achievement Service MVP.

## Production Features

### ✅ Environment Configuration
- Environment-specific configuration files
- Secure environment variable handling
- Production-optimized settings

### ✅ Structured Logging
- Winston logger with JSON formatting
- Daily log rotation
- Configurable log levels
- Production-ready log aggregation

### ✅ Prometheus Metrics
- HTTP request metrics (rate, duration, status codes)
- Achievement-specific metrics (unlocks, progress updates)
- Service integration metrics (calls, errors, circuit breakers)
- Database and cache performance metrics
- System resource metrics (CPU, memory)

### ✅ Graceful Shutdown
- SIGTERM/SIGINT signal handling
- Connection cleanup
- Configurable shutdown timeout
- Resource cleanup

### ✅ Security & Rate Limiting
- Helmet security headers
- CORS configuration
- Rate limiting with @nestjs/throttler
- Request compression
- Input validation

### ✅ Service Integration Monitoring
- Circuit breaker pattern
- Health checks for external services
- Service call metrics and error tracking
- Automatic retry logic

## Environment Variables

### Required Production Variables

```bash
# Database
DATABASE_HOST=your-postgres-host
DATABASE_NAME=achievement_db
DATABASE_USER=achievement_user
DATABASE_PASSWORD=your-secure-password

# Security
JWT_SECRET=your-very-secure-jwt-secret-key

# Redis
REDIS_HOST=your-redis-host
REDIS_PASSWORD=your-redis-password

# Service URLs
NOTIFICATION_SERVICE_URL=http://notification-service:3000
LIBRARY_SERVICE_URL=http://library-service:3000
PAYMENT_SERVICE_URL=http://payment-service:3000
REVIEW_SERVICE_URL=http://review-service:3000
SOCIAL_SERVICE_URL=http://social-service:3000
```

### Optional Configuration

```bash
# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=100

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000

# Circuit Breaker
SERVICE_CIRCUIT_BREAKER_THRESHOLD=5
SERVICE_CIRCUIT_BREAKER_TIMEOUT=60000
```

## Deployment

### Docker Production Build

```bash
# Build production image
npm run docker:build:prod

# Run with production compose
npm run docker:up:prod
```

### Kubernetes Deployment

The service includes Kubernetes-ready health checks:

- **Liveness Probe**: `/api/v1/health/live`
- **Readiness Probe**: `/api/v1/health/ready`
- **Startup Probe**: `/api/v1/health/startup`

Example Kubernetes deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: achievement-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: achievement-service
  template:
    metadata:
      labels:
        app: achievement-service
    spec:
      containers:
      - name: achievement-service
        image: achievement-service:latest
        ports:
        - containerPort: 3003
        env:
        - name: NODE_ENV
          value: "production"
        livenessProbe:
          httpGet:
            path: /api/v1/health/live
            port: 3003
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/health/ready
            port: 3003
          initialDelaySeconds: 5
          periodSeconds: 5
        startupProbe:
          httpGet:
            path: /api/v1/health/startup
            port: 3003
          initialDelaySeconds: 10
          periodSeconds: 5
          failureThreshold: 30
```

## Monitoring & Observability

### Prometheus Metrics

Metrics are available at `/api/v1/metrics`:

#### HTTP Metrics
- `http_requests_total` - Total HTTP requests by method, route, status
- `http_request_duration_seconds` - HTTP request duration histogram

#### Achievement Metrics
- `achievements_unlocked_total` - Total achievements unlocked
- `progress_updates_total` - Total progress updates
- `achievement_check_duration_seconds` - Achievement condition check duration

#### Service Integration Metrics
- `service_calls_total` - External service calls by service, method, status
- `service_call_duration_seconds` - Service call duration
- `service_errors_total` - Service integration errors

#### System Metrics
- `database_connections_active` - Active database connections
- `database_query_duration_seconds` - Database query duration
- `cache_hits_total` / `cache_misses_total` - Cache performance

### Health Checks

#### Overall Health: `/api/v1/health`
Returns comprehensive health status including database, Redis, and external services.

#### Service Integration Health: `/api/v1/monitoring/health/services`
Returns health status of all integrated MVP services.

#### Circuit Breaker Status: `/api/v1/monitoring/circuit-breakers`
Returns current circuit breaker states for external services.

### Grafana Dashboard

Import the provided Grafana dashboard (`monitoring/grafana-dashboard.json`) for comprehensive monitoring:

- HTTP request rates and response times
- Achievement unlock rates and progress updates
- Service integration health and error rates
- Database and cache performance
- System resource usage

### Alerting

Prometheus alerting rules are provided in `monitoring/achievement_service_rules.yml`:

- High error rate (>10% 5xx responses)
- High response time (>1s 95th percentile)
- Service down
- Database connection issues
- High cache miss rate
- Service integration failures
- Circuit breaker open alerts

## Production Checklist

### Pre-Deployment
- [ ] Set all required environment variables
- [ ] Configure secure JWT secret
- [ ] Set up database with proper user permissions
- [ ] Configure Redis instance
- [ ] Set up log aggregation (ELK stack, etc.)
- [ ] Configure monitoring (Prometheus + Grafana)
- [ ] Set up alerting rules

### Post-Deployment
- [ ] Verify health checks are passing
- [ ] Check metrics are being collected
- [ ] Verify service integrations are working
- [ ] Test circuit breaker functionality
- [ ] Validate log aggregation
- [ ] Test graceful shutdown
- [ ] Run load tests
- [ ] Verify alerting is working

## Performance Targets

### Response Times
- 95th percentile < 200ms for achievement queries
- 95th percentile < 500ms for progress updates
- Health checks < 100ms

### Throughput
- Support 1000+ concurrent users
- Handle 100+ requests/second per instance
- Process achievement unlocks within 1 second

### Availability
- 99.9% uptime target
- Graceful degradation when external services are down
- Circuit breaker protection for external calls

## Troubleshooting

### Common Issues

#### High Memory Usage
- Check for memory leaks in application code
- Monitor database connection pool size
- Review cache configuration

#### High Response Times
- Check database query performance
- Monitor external service response times
- Review circuit breaker states

#### Service Integration Failures
- Check external service health
- Review circuit breaker thresholds
- Verify network connectivity

### Log Analysis

Production logs are structured JSON for easy parsing:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "message": "Achievement unlocked",
  "context": "AchievementService",
  "userId": "user-123",
  "achievementId": "first-purchase",
  "duration": 45
}
```

### Metrics Queries

Useful Prometheus queries:

```promql
# Error rate
rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])

# 95th percentile response time
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Achievement unlock rate
rate(achievements_unlocked_total[1h])

# Service integration success rate
rate(service_calls_total{status="success"}[5m]) / rate(service_calls_total[5m])
```

## Security Considerations

### Production Security
- Use strong JWT secrets (256-bit minimum)
- Enable SSL/TLS for all connections
- Configure proper CORS origins
- Use security headers (Helmet)
- Implement rate limiting
- Regular security updates

### Database Security
- Use dedicated database user with minimal permissions
- Enable SSL connections
- Regular backups
- Monitor for suspicious queries

### Service Communication
- Use service mesh or VPN for internal communication
- Implement proper authentication between services
- Monitor service-to-service calls

## Maintenance

### Regular Tasks
- Monitor disk space for logs
- Review and rotate logs
- Update dependencies
- Review metrics and alerts
- Performance testing
- Security audits

### Scaling
- Monitor CPU and memory usage
- Scale horizontally by adding instances
- Consider database read replicas for high load
- Implement caching strategies

## Support

For production issues:
1. Check health endpoints
2. Review structured logs
3. Check Prometheus metrics
4. Verify external service health
5. Review circuit breaker states