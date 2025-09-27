# Production Deployment Checklist - Achievement Service

## Pre-Deployment Validation

### Environment Configuration
- [ ] All required environment variables are set in `.env.production`
- [ ] JWT_SECRET is at least 32 characters and cryptographically secure
- [ ] Database credentials are configured and tested
- [ ] Redis credentials are configured and tested
- [ ] Service integration URLs are configured for production environment
- [ ] CORS_ORIGIN is set to production frontend URL
- [ ] LOG_LEVEL is set to 'warn' or 'error' for production
- [ ] Rate limiting is configured appropriately for expected load

### Security Configuration
- [ ] DATABASE_SSL is enabled (`true`)
- [ ] HELMET_ENABLED is enabled (`true`)
- [ ] COMPRESSION_ENABLED is enabled (`true`)
- [ ] Security headers are properly configured
- [ ] Rate limiting is enabled and configured
- [ ] No sensitive data in logs or error messages

### Build and Dependencies
- [ ] Application builds successfully (`npm run build`)
- [ ] All tests pass (`npm run test:all`)
- [ ] No security vulnerabilities in dependencies (`npm audit`)
- [ ] Production dependencies are installed (`npm ci --only=production`)
- [ ] TypeScript compilation is successful

### Database Setup
- [ ] Database migrations are up to date (`npm run migration:run`)
- [ ] Seed data is loaded for basic achievements
- [ ] Database connection pooling is configured
- [ ] Database indexes are optimized for production queries

### Monitoring and Observability
- [ ] Prometheus metrics endpoint is accessible (`/api/v1/metrics`)
- [ ] Health check endpoints are working (`/api/v1/health`, `/api/v1/health/ready`, `/api/v1/health/live`)
- [ ] Structured logging is configured with appropriate log levels
- [ ] Log rotation is configured (daily rotation, 30-day retention)
- [ ] Alert rules are configured in Prometheus/Alertmanager

### Performance and Scalability
- [ ] Memory limits are configured appropriately
- [ ] CPU limits are configured appropriately
- [ ] Redis caching is enabled and configured
- [ ] Database connection pooling is optimized
- [ ] Graceful shutdown timeout is configured

## Deployment Steps

### 1. Pre-deployment Validation
```bash
# Run the production configuration validation script
node scripts/validate-production-config.js

# Run all tests
npm run test:all

# Build the application
npm run build

# Validate Docker image builds
npm run docker:build:prod
```

### 2. Database Migration
```bash
# Run database migrations
npm run migration:run

# Verify migrations were applied
npm run migration:show
```

### 3. Service Deployment
```bash
# Deploy using Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Or deploy to Kubernetes
kubectl apply -f k8s/
```

### 4. Post-deployment Verification
```bash
# Check service health
curl http://localhost:3003/api/v1/health

# Check readiness
curl http://localhost:3003/api/v1/health/ready

# Check metrics endpoint
curl http://localhost:3003/api/v1/metrics

# Verify service integration monitoring
curl http://localhost:3003/api/v1/monitoring/health/overall
```

## Post-Deployment Monitoring

### Immediate Checks (First 15 minutes)
- [ ] Service starts successfully and stays running
- [ ] Health checks are passing
- [ ] No critical errors in logs
- [ ] Database connections are established
- [ ] Redis connections are working
- [ ] Metrics are being collected

### Short-term Monitoring (First Hour)
- [ ] Response times are within acceptable limits (< 200ms for 95th percentile)
- [ ] Memory usage is stable and within limits
- [ ] No memory leaks detected
- [ ] Service integrations are working
- [ ] Achievement processing is functioning correctly

### Long-term Monitoring (First 24 Hours)
- [ ] No performance degradation over time
- [ ] Log rotation is working correctly
- [ ] Alerts are configured and firing appropriately
- [ ] Service integration circuit breakers are functioning
- [ ] Achievement unlock rates are as expected

## Rollback Plan

### Immediate Rollback Triggers
- Service fails to start or crashes repeatedly
- Critical errors affecting core functionality
- Database connection failures
- Memory usage exceeds 90% consistently
- Response times exceed 2 seconds for 95th percentile

### Rollback Steps
1. **Stop current deployment**
   ```bash
   docker-compose -f docker-compose.prod.yml down
   # or
   kubectl rollout undo deployment/achievement-service
   ```

2. **Revert to previous version**
   ```bash
   # Deploy previous Docker image
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Verify rollback**
   ```bash
   curl http://localhost:3003/api/v1/health
   ```

4. **Database rollback (if needed)**
   ```bash
   npm run migration:revert
   ```

## Production Environment Variables Checklist

### Required Variables
- [ ] `NODE_ENV=production`
- [ ] `DATABASE_PASSWORD` (secure password)
- [ ] `JWT_SECRET` (32+ character secure string)
- [ ] `CORS_ORIGIN` (production frontend URL)
- [ ] `REDIS_PASSWORD` (if Redis auth is enabled)

### Security Variables
- [ ] `DATABASE_SSL=true`
- [ ] `HELMET_ENABLED=true`
- [ ] `COMPRESSION_ENABLED=true`
- [ ] `LOG_LEVEL=warn`
- [ ] `RATE_LIMIT_LIMIT=100`

### Service Integration Variables
- [ ] `NOTIFICATION_SERVICE_URL`
- [ ] `LIBRARY_SERVICE_URL`
- [ ] `PAYMENT_SERVICE_URL`
- [ ] `REVIEW_SERVICE_URL`
- [ ] `SOCIAL_SERVICE_URL`

### Performance Variables
- [ ] `SHUTDOWN_TIMEOUT=10000`
- [ ] `DATABASE_MAX_CONNECTIONS=20`
- [ ] `CACHE_TTL=300`
- [ ] `SERVICE_TIMEOUT=5000`

## Monitoring Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/api/v1/health` | General health check | 200 OK with service status |
| `/api/v1/health/ready` | Kubernetes readiness probe | 200 OK when ready to serve traffic |
| `/api/v1/health/live` | Kubernetes liveness probe | 200 OK when service is alive |
| `/api/v1/metrics` | Prometheus metrics | Metrics in Prometheus format |
| `/api/v1/monitoring/health/overall` | Service integration status | Overall integration health |

## Performance Benchmarks

### Response Time Targets
- 95th percentile: < 200ms
- 99th percentile: < 500ms
- Average: < 100ms

### Resource Usage Targets
- Memory: < 512MB under normal load
- CPU: < 50% under normal load
- Database connections: < 15 active connections

### Throughput Targets
- 1000+ requests per minute
- 100+ concurrent users
- 10+ achievements unlocked per minute

## Emergency Contacts

- **DevOps Team**: [Contact Information]
- **Database Administrator**: [Contact Information]
- **Security Team**: [Contact Information]
- **Product Owner**: [Contact Information]

## Documentation Links

- [API Documentation](http://localhost:3003/api/docs) (Development)
- [Monitoring Dashboard](http://localhost:3000) (Grafana)
- [Alert Manager](http://localhost:9093) (Alertmanager)
- [Service Architecture](./README.md)