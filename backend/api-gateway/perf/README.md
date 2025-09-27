# API Gateway Performance Tests

Performance testing suite for MVP validation using [Artillery](https://www.artillery.io/).

## MVP Requirements

The API Gateway must meet these performance criteria for MVP:

- ✅ **1000 concurrent users**: System must handle 1000 simultaneous users
- ✅ **Response time < 200ms**: 95th percentile response time must be under 200ms
- ✅ **System stability**: Must remain stable under sustained MVP load

## Test Configurations

### Core Tests

- `smoke.yml`: Quick validation test (30s, 10 users/sec)
- `load.yml`: Enhanced load test with comprehensive scenarios
- `stress.yml`: Stress test beyond normal capacity
- `mvp-load.yml`: **MVP-specific test** (1000 users, <200ms requirement)
- `stability.yml`: Extended stability test (45 minutes sustained load)

### Test Scenarios

Each test includes realistic user behavior patterns:

1. **Game catalog browsing** (50% of traffic)
   - Browse games list
   - View game details
   - Search and filter games

2. **User authentication** (25% of traffic)
   - Login requests
   - Profile access
   - Protected resource access

3. **Health monitoring** (15% of traffic)
   - Health check endpoints
   - Service status monitoring

4. **Mixed operations** (10% of traffic)
   - Combined API usage patterns

## Quick Start

### Prerequisites

1. Ensure API Gateway is running:
   ```bash
   npm run start:dev
   # or
   npm run docker:dev
   ```

2. Verify service is accessible:
   ```bash
   curl http://localhost:3001/health
   ```

### Running MVP Tests

#### Option 1: Complete MVP Test Suite
```bash
# Run all MVP performance tests (includes stability test ~45 min)
npm run perf:mvp-all
```

#### Option 2: Quick MVP Validation
```bash
# Run MVP tests without long stability test (~10 min)
npm run perf:mvp-quick
```

#### Option 3: Individual Tests
```bash
# Quick smoke test
npm run perf:smoke

# MVP load test (1000 users)
npm run perf:mvp

# Extended stability test
npm run perf:stability

# Original load test
npm run perf:load

# Stress test
npm run perf:stress
```

## Configuration

### Environment Variables

- `BASE_URL`: Target URL (default: `http://localhost:3001`)

Example:
```bash
$env:BASE_URL = "https://api.gaming-platform.ru"
npm run perf:mvp
```

### Performance Thresholds

MVP tests enforce these thresholds:

```yaml
ensure:
  p95: 200    # 95th percentile < 200ms (MVP requirement)
  p50: 100    # Median < 100ms (good performance)
  p90: 150    # 90th percentile < 150ms
  max: 500    # Maximum response time
  maxErrorRate: 1  # Error rate < 1%
```

## Results and Reports

### Output Locations

- **JSON Results**: `perf/results/*.json`
- **HTML Reports**: `perf/results/*.html`
- **Console Output**: Real-time metrics during test execution

### Key Metrics to Monitor

1. **Response Times**
   - p50 (median): Should be < 100ms
   - p95: **Must be < 200ms for MVP**
   - p99: Should be < 400ms
   - max: Should not exceed 500ms

2. **Throughput**
   - Requests per second (RPS)
   - Concurrent users handled
   - Request completion rate

3. **Error Rates**
   - HTTP error responses
   - Timeout errors
   - Connection errors
   - **Total error rate must be < 1%**

4. **System Stability**
   - Consistent performance over time
   - No memory leaks or degradation
   - Graceful handling of peak load

### Sample Report Analysis

```
Scenarios launched:  60000
Scenarios completed: 59950
Requests completed:  179850

Response time (ms):
  min: 12
  max: 487
  median: 45.2
  p95: 156.7     ✅ < 200ms (MVP requirement met)
  p99: 298.4

Codes:
  200: 179650    ✅ 99.9% success rate
  404: 150
  500: 50        ✅ < 1% error rate
```

## Troubleshooting

### Common Issues

1. **Service Not Available**
   ```
   ERROR: Service is not available at http://localhost:3001
   ```
   - Ensure API Gateway is running
   - Check if port 3001 is accessible
   - Verify health endpoint responds

2. **High Response Times**
   - Check system resources (CPU, memory)
   - Verify database connections
   - Monitor Redis performance
   - Check network latency

3. **High Error Rates**
   - Review application logs
   - Check service dependencies
   - Verify authentication setup
   - Monitor rate limiting

### Performance Optimization Tips

1. **Connection Pooling**: Ensure HTTP clients use connection pooling
2. **Caching**: Implement Redis caching for frequently accessed data
3. **Database Optimization**: Optimize database queries and connections
4. **Resource Limits**: Configure appropriate CPU and memory limits
5. **Load Balancing**: Use multiple instances for higher throughput

## MVP Validation Checklist

Before marking MVP performance testing as complete:

- [ ] Smoke test passes (basic functionality)
- [ ] MVP load test handles 1000 concurrent users
- [ ] Response time p95 < 200ms consistently
- [ ] Error rate < 1% under load
- [ ] System remains stable during extended testing
- [ ] All critical endpoints tested (games, auth, health)
- [ ] Performance reports generated and reviewed
- [ ] Any performance issues documented and addressed

## Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Performance Testing
  run: |
    npm run start:prod &
    sleep 30
    npm run perf:mvp-quick
    pkill -f "npm run start:prod"
```

### Monitoring Integration

Performance test results can be integrated with:

- **Prometheus**: Metrics collection
- **Grafana**: Performance dashboards  
- **AlertManager**: Performance threshold alerts
- **Slack/Teams**: Test result notifications

