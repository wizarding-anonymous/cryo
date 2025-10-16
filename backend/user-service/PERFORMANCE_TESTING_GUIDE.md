# Performance Testing Guide - User Service

## 📊 Overview

This guide covers comprehensive performance testing for the User Service, including batch operations, concurrent user load testing, cache performance, database optimization, and memory leak detection.

## 🎯 Performance Requirements

Based on task 13.3, the User Service must meet these performance criteria:

### Batch Operations (10k+ records)
- **Batch Creation**: Handle 10,000+ user creation in under 60 seconds (>100 users/sec)
- **Batch Lookup**: Process 10,000+ user lookups in under 5 seconds (>2000 lookups/sec)
- **Batch Updates**: Update 10,000+ users in under 15 seconds (>500 updates/sec)
- **Memory Usage**: Less than 500MB memory increase during large batch operations

### Concurrent Users (1000+ simultaneous)
- **Concurrent Load**: Handle 1000+ simultaneous users with >99% success rate
- **Response Time**: 95th percentile under 200ms, 99th percentile under 500ms
- **Throughput**: Minimum 50 operations per second under peak load
- **Error Rate**: Less than 1% error rate under normal load

### Cache & Database Performance
- **Cache Hit Ratio**: Maintain >70% cache hit ratio under normal load
- **Cache Performance**: 10x faster response times for cached vs uncached data
- **Database Queries**: Indexed queries under 100ms, complex queries under 500ms
- **Connection Pooling**: Efficient handling of 100+ concurrent database connections

### Memory & Resource Usage
- **Memory Leaks**: No continuous memory growth over sustained periods
- **Resource Limits**: Peak memory usage under 1GB, reasonable CPU utilization
- **Garbage Collection**: Effective memory cleanup with <100MB net growth per test cycle

## 🧪 Test Suite Structure

### 1. Jest-based E2E Performance Tests

#### Batch Operations Test (`performance-batch-operations.e2e-spec.ts`)
```bash
npm run perf:test:batch
```

**Tests Include:**
- Large batch creation (10k, 25k users)
- Batch lookup performance
- Batch update operations
- Memory leak detection during batch operations
- Resource usage monitoring

**Key Metrics:**
- Throughput (users/operations per second)
- Memory usage and growth
- Response times and latency
- Success/failure rates

#### Concurrent Users Test (`load-test-concurrent-users.e2e-spec.ts`)
```bash
npm run perf:test:concurrent
```

**Tests Include:**
- 1000+ concurrent user registrations
- 1500+ concurrent user lookups
- 2000+ mixed concurrent operations
- Sustained load testing (5+ minutes)
- Spike load testing (sudden traffic spikes)
- Gradual ramp-up testing (100 → 1500 users)

**Key Metrics:**
- Concurrent user capacity
- Success rates under load
- Response time percentiles (P95, P99)
- System stability under sustained load

#### Cache & Database Performance Test (`performance-cache-database.e2e-spec.ts`)
```bash
npm run perf:test:cache
```

**Tests Include:**
- Cache hit/miss performance comparison
- Cache warm-up efficiency
- Cache invalidation performance
- Database query optimization
- Connection pooling efficiency
- JSONB query performance
- Cache-database integration patterns

**Key Metrics:**
- Cache hit ratios and performance gains
- Database query response times
- Connection pool utilization
- Memory usage during caching operations

#### Memory & Resource Usage Test (`performance-memory-resource.e2e-spec.ts`)
```bash
npm run perf:test:memory
```

**Tests Include:**
- Memory leak detection over multiple iterations
- Large object creation and cleanup
- Sustained load resource monitoring
- Memory pressure handling
- Garbage collection effectiveness

**Key Metrics:**
- Memory growth patterns
- Resource usage under load
- Garbage collection efficiency
- System stability under memory pressure

### 2. Advanced Node.js Load Test

#### Comprehensive Load Test (`advanced-performance-test.js`)
```bash
npm run perf:test:advanced
```

**Features:**
- Pure Node.js implementation (no external dependencies)
- Realistic user behavior simulation
- Detailed performance metrics collection
- Resource usage monitoring
- Comprehensive reporting

**Test Phases:**
1. **Batch Operations**: 1k, 5k, 10k, 15k user batches
2. **Concurrent Users**: 500, 1000, 1500, 2000 concurrent operations
3. **Sustained Load**: 800 users for 5 minutes
4. **Spike Testing**: Sudden spike to 1800 users
5. **Memory Leak Detection**: 15 iterations with cleanup verification

### 3. External Load Testing Tools

#### k6 Load Test
```bash
npm run perf:test:k6
```

**Requirements:** Install k6 from https://k6.io/docs/getting-started/installation/

**Features:**
- Professional load testing with k6
- Configurable load phases and thresholds
- Detailed performance metrics
- Integration with CI/CD pipelines

#### Artillery Load Test
```bash
npm run perf:test:artillery
```

**Requirements:** `npm install -g artillery`

**Features:**
- HTTP-focused load testing
- Realistic user scenarios
- Performance threshold validation
- HTML report generation

## 🚀 Running Performance Tests

### Quick Start

1. **Start the User Service:**
```bash
npm run dev:setup
npm run start:dev
```

2. **Run All Performance Tests:**
```bash
npm run perf:test:all
```

3. **View Reports:**
```bash
npm run perf:report
```

### Individual Test Execution

```bash
# Batch operations performance
npm run perf:test:batch

# Concurrent users load test
npm run perf:test:concurrent

# Cache and database performance
npm run perf:test:cache

# Memory and resource usage
npm run perf:test:memory

# Advanced Node.js load test
npm run perf:test:advanced

# k6 load test (if k6 is installed)
npm run perf:test:k6

# Artillery load test (if artillery is installed)
npm run perf:test:artillery
```

### Environment Configuration

Set environment variables to customize test parameters:

```bash
# Base URL for testing
export BASE_URL=http://localhost:3001

# Maximum concurrent users for load tests
export MAX_CONCURRENT_USERS=1500

# Test duration in milliseconds
export TEST_DURATION=600000

# Enable garbage collection for memory tests
node --expose-gc npm run perf:test:memory
```

## 📊 Performance Metrics & Thresholds

### Response Time Thresholds
- **P95 Response Time**: < 200ms (normal load), < 500ms (peak load)
- **P99 Response Time**: < 500ms (normal load), < 1000ms (peak load)
- **Average Response Time**: < 100ms (cached), < 300ms (uncached)

### Throughput Thresholds
- **Batch Creation**: > 100 users/second
- **Batch Lookup**: > 2000 lookups/second
- **Batch Updates**: > 500 updates/second
- **Concurrent Operations**: > 50 operations/second (peak load)

### Success Rate Thresholds
- **Normal Load**: > 99% success rate
- **Peak Load**: > 95% success rate
- **Spike Load**: > 90% success rate

### Resource Usage Thresholds
- **Memory Growth**: < 200MB per test cycle
- **Peak Memory**: < 1GB heap usage
- **Memory Leaks**: < 100MB net growth over multiple cycles

### Cache Performance Thresholds
- **Hit Ratio**: > 70% under normal load
- **Performance Gain**: > 5x faster for cached responses
- **Invalidation Speed**: < 10ms per cache invalidation

## 📈 Report Generation

### Automated Reports

The comprehensive test runner generates multiple report formats:

1. **JSON Report**: Detailed machine-readable results
2. **HTML Report**: Interactive web-based dashboard
3. **Text Summary**: Console-friendly summary

Reports are saved in `performance-reports/` directory with timestamps.

### Report Contents

- **Test Summary**: Overall success rates and timing
- **Individual Test Results**: Detailed results for each test
- **Resource Usage**: Memory and CPU utilization
- **Performance Metrics**: Response times, throughput, error rates
- **Recommendations**: Actionable insights for optimization

### Sample Report Structure
```
performance-reports/
├── performance-report-2024-01-15T10-30-00.json
├── performance-summary-2024-01-15T10-30-00.txt
└── performance-report-2024-01-15T10-30-00.html
```

## 🔧 Troubleshooting

### Common Issues

#### Service Not Running
```
Error: Health check failed
Solution: Start the service with `npm run dev:setup && npm run start:dev`
```

#### High Memory Usage
```
Error: Memory usage exceeds thresholds
Solution: Check for memory leaks, optimize batch sizes, enable garbage collection
```

#### Slow Response Times
```
Error: P95 response time > 200ms
Solution: Optimize database queries, improve caching, check connection pooling
```

#### Low Success Rates
```
Error: Success rate < 99%
Solution: Check error logs, verify database connections, review rate limiting
```

### Performance Optimization Tips

1. **Database Optimization**
   - Add appropriate indexes
   - Optimize query patterns
   - Use connection pooling
   - Implement query caching

2. **Caching Strategy**
   - Implement multi-level caching
   - Use cache warming
   - Optimize cache invalidation
   - Monitor hit ratios

3. **Memory Management**
   - Enable garbage collection
   - Optimize object lifecycle
   - Use streaming for large datasets
   - Monitor memory patterns

4. **Concurrency Handling**
   - Implement proper rate limiting
   - Use connection pooling
   - Optimize async operations
   - Handle backpressure

## 🎯 CI/CD Integration

### GitHub Actions Integration

Add performance testing to your CI/CD pipeline:

```yaml
name: Performance Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: test_password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run performance tests
        run: npm run perf:test:all
        env:
          BASE_URL: http://localhost:3001
          MAX_CONCURRENT_USERS: 1000
          TEST_DURATION: 300000
      
      - name: Upload performance reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: performance-reports
          path: performance-reports/
```

### Performance Monitoring

Set up continuous performance monitoring:

1. **Baseline Establishment**: Run tests regularly to establish performance baselines
2. **Regression Detection**: Compare results against historical data
3. **Alert Thresholds**: Set up alerts for performance degradation
4. **Trend Analysis**: Monitor performance trends over time

## 📚 Best Practices

### Test Design
- Use realistic data volumes and patterns
- Test both normal and edge cases
- Include gradual ramp-up and spike scenarios
- Monitor resource usage throughout tests

### Data Management
- Clean up test data between runs
- Use separate test databases
- Implement proper test isolation
- Handle test data lifecycle properly

### Monitoring
- Collect comprehensive metrics
- Monitor system resources
- Track performance trends
- Set up alerting for regressions

### Reporting
- Generate actionable reports
- Include performance recommendations
- Track improvements over time
- Share results with stakeholders

## 🔍 Advanced Topics

### Custom Metrics Collection
Implement custom metrics for specific business requirements:

```typescript
// Example: Custom response time tracking
const customMetrics = {
  userCreationTime: [],
  cacheHitRatio: 0,
  databaseQueryTime: [],
};
```

### Load Pattern Simulation
Create realistic load patterns based on production traffic:

```typescript
// Example: Realistic user behavior simulation
const userBehaviorPatterns = {
  registration: 0.1,    // 10% registration
  login: 0.3,           // 30% login
  profileUpdate: 0.2,   // 20% profile updates
  dataRetrieval: 0.4,   // 40% data retrieval
};
```

### Performance Profiling
Use Node.js profiling tools for detailed analysis:

```bash
# CPU profiling
node --prof npm run perf:test:advanced

# Memory profiling
node --inspect npm run perf:test:memory
```

This comprehensive performance testing suite ensures the User Service meets all requirements for handling 10k+ batch operations, 1000+ concurrent users, and maintains optimal cache and database performance while preventing memory leaks.