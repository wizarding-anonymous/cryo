# Load Testing for Review Service

This directory contains load testing scripts for the Review Service using k6.

## Prerequisites

1. Install k6: https://k6.io/docs/getting-started/installation/
2. Ensure the Review Service is running
3. Have valid JWT tokens for authentication (update in load-test.js)

## Running Tests

### Local Testing
```bash
npm run test:local
```

### Staging Environment
```bash
npm run test:staging
```

### Production Environment
```bash
npm run test:production
```

### Custom URL
```bash
BASE_URL=http://your-service-url:3004 k6 run load-test.js
```

## Test Scenarios

The load test simulates 1000 concurrent users with the following scenarios:

- **40%** - Create reviews (POST /reviews)
- **30%** - Get game reviews (GET /reviews/game/:gameId)
- **20%** - Get game ratings (GET /ratings/game/:gameId)
- **10%** - Health checks (GET /health)

## Performance Thresholds

- **Response Time**: 95% of requests must complete under 200ms
- **Error Rate**: Must be below 10%
- **Availability**: Service must remain available throughout the test

## Test Stages

1. **Ramp Up** (2 min): 0 → 100 users
2. **Scale Up** (5 min): 100 → 500 users
3. **Peak Load** (10 min): 500 → 1000 users
4. **Sustained Load** (10 min): 1000 users
5. **Scale Down** (5 min): 1000 → 500 users
6. **Ramp Down** (2 min): 500 → 0 users

## Monitoring

During load testing, monitor:

- CPU and memory usage
- Database connection pool
- Redis cache hit rates
- External service response times
- Error logs and exceptions

## Results Analysis

After running the test, k6 will provide:

- Request duration percentiles
- Error rates by endpoint
- Throughput metrics
- Custom metrics for service health

Use these metrics to identify bottlenecks and optimize performance.