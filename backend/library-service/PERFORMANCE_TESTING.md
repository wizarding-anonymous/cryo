# Library Service Performance Testing Guide

## Overview

This document describes the comprehensive performance testing and optimization implementation for the Library Service. The performance testing suite includes load tests, database stress tests, benchmarks, and optimization strategies to ensure the service meets the specified performance requirements.

## Performance Requirements (from Spec)

- **Library load**: < 200ms (95th percentile)
- **Search operations**: < 500ms (90th percentile)  
- **Ownership checks**: < 100ms (95th percentile)
- **Throughput**: Support 1000+ concurrent users
- **Error rate**: < 1%

## Performance Testing Infrastructure

### 1. Load Testing with K6

#### Basic Load Test
```bash
npm run perf:test:basic
```
- Tests basic API endpoints under load
- Validates response times and error rates
- Configurable virtual users and duration

#### Comprehensive Performance Suite
```bash
npm run perf:test:suite
```
- Large library load testing
- Search performance under load
- Concurrent ownership checks
- Mixed workload simulation

#### Database Stress Testing
```bash
npm run perf:test:database
```
- Connection pool stress testing
- Complex query performance
- Concurrent write operations
- Large dataset pagination

### 2. Jest Performance Tests

#### Benchmark Tests
```bash
npm run perf:benchmark
```
- Comprehensive library benchmark suite
- Database query performance
- Cache performance testing
- Memory leak detection
- Stress testing with large datasets

#### Performance Monitoring Tests
```bash
npm run perf:monitor
```
- Performance metrics collection
- Health check validation
- System resource monitoring

### 3. Performance Optimization Features

#### Database Optimizations
- **Indexes**: Composite indexes for common query patterns
- **Materialized Views**: Pre-computed statistics for expensive aggregations
- **Stored Procedures**: Optimized queries for pagination and search
- **Connection Pooling**: Configurable pool sizes and timeouts
- **Query Optimization**: Prepared statements and batch operations

#### Caching Strategy
- **Redis Integration**: Distributed caching with configurable TTL
- **Cache Warming**: Automatic preloading of frequently accessed data
- **Cache Invalidation**: Smart invalidation based on user and game operations
- **Cache Statistics**: Hit rate monitoring and optimization

#### Application Performance
- **Memory Management**: Automatic garbage collection and memory monitoring
- **Request Optimization**: Compression, keep-alive, and timeout configuration
- **Bulk Operations**: Batch processing for large datasets
- **Performance Monitoring**: Real-time metrics and alerting

## Performance Test Files

### K6 Load Tests
- `load-tests/k6-script.js` - Basic load testing
- `load-tests/performance-test-suite.js` - Comprehensive performance scenarios
- `load-tests/database-stress-test.js` - Database-focused stress testing

### Jest Performance Tests
- `test/performance.e2e-spec.ts` - Large dataset performance testing
- `test/benchmark.e2e-spec.ts` - Comprehensive benchmarking suite

### Performance Services
- `src/performance/benchmark.service.ts` - Benchmarking utilities
- `src/performance/performance-monitor.service.ts` - Real-time monitoring
- `src/performance/performance-optimizer.service.ts` - Automatic optimization

### Database Optimizations
- `src/migrations/1703000000000-OptimizePerformanceIndexes.ts` - Performance indexes
- `src/migrations/1703000000001-OptimizeDatabaseConfiguration.ts` - Database optimization
- `src/library/repositories/optimized-library.repository.ts` - Optimized queries

## Running Performance Tests

### Prerequisites
1. **K6 Installation**: Install k6 for load testing
   ```bash
   # Windows (using Chocolatey)
   choco install k6
   
   # macOS (using Homebrew)
   brew install k6
   
   # Linux (using package manager)
   sudo apt-get install k6
   ```

2. **Database Setup**: Ensure PostgreSQL and Redis are running
   ```bash
   npm run docker:dev
   ```

### Test Execution

#### Full Performance Test Suite
```bash
npm run perf:test
```
This runs all performance tests including:
- Basic load tests
- Performance test suite
- Database stress tests
- Jest performance tests

#### Individual Test Categories
```bash
# Basic load testing
npm run perf:test:basic

# Comprehensive performance suite
npm run perf:test:suite

# Database stress testing
npm run perf:test:database

# Jest performance tests
npm run perf:test:jest
```

#### Benchmark Testing
```bash
# Run benchmark tests
npm run perf:benchmark

# Run performance monitoring tests
npm run perf:monitor
```

### Test Configuration

#### Environment Variables
```bash
# K6 Load Tests
BASE_URL=http://localhost:3000/api
JWT_TOKEN=your_jwt_token_here
REQUIRE_AUTH=true
TEST_DURATION=5m
MAX_VUS=1000

# Database Configuration
DB_MAX_CONNECTIONS=20
DB_MIN_CONNECTIONS=5
DB_QUERY_TIMEOUT=30000

# Cache Configuration
REDIS_MAX_CONNECTIONS=10
CACHE_DEFAULT_TTL=300
CACHE_WARMING_ENABLED=true

# Performance Monitoring
PERFORMANCE_MONITORING_ENABLED=true
PERFORMANCE_METRICS_INTERVAL=30000
```

## Performance Optimization Configuration

### Database Connection Pool
```typescript
// Optimized for high concurrency
maxConnections: 20,
minConnections: 5,
acquireTimeoutMillis: 60000,
idleTimeoutMillis: 30000,
```

### Cache Configuration
```typescript
// Optimized TTL values
libraryTtl: 600,      // 10 minutes
searchTtl: 180,       // 3 minutes
ownershipTtl: 900,    // 15 minutes
statsTtl: 1800,       // 30 minutes
```

### Performance Thresholds
```typescript
// Auto-scaling thresholds
cpuThreshold: 80,
memoryThreshold: 85,
responseTimeThreshold: 1000,
errorRateThreshold: 0.05,
```

## Performance Monitoring

### Real-time Metrics
- Request count and response times
- Error rates and status code distribution
- Memory and CPU usage
- Database connection pool utilization
- Cache hit rates and performance

### Health Checks
- System resource monitoring
- Database connectivity
- Cache performance
- External service availability

### Performance Recommendations
The system automatically generates performance recommendations based on:
- Memory usage patterns
- Database performance metrics
- Cache efficiency
- Request performance trends

## Troubleshooting Performance Issues

### High Response Times
1. Check database query performance
2. Verify cache hit rates
3. Monitor connection pool utilization
4. Review slow query logs

### High Memory Usage
1. Check for memory leaks in tests
2. Verify garbage collection frequency
3. Monitor cache memory usage
4. Review bulk operation sizes

### Database Performance
1. Analyze slow queries
2. Check index usage
3. Monitor connection pool
4. Review materialized view refresh

### Cache Performance
1. Monitor hit rates
2. Check TTL configurations
3. Verify cache warming
4. Review invalidation patterns

## Performance Test Results

Test results are automatically saved in the `performance-results/` directory with timestamps. Each test run generates:

- JSON result files with detailed metrics
- Summary reports with key performance indicators
- Performance recommendations
- Trend analysis over time

### Sample Performance Report
```
=== Library Service Performance Test Report ===

Test Date: 2024-01-15 10:30:00
Base URL: http://localhost:3000/api
Test Duration: 5m
Max Virtual Users: 1000

Performance Requirements Verification:
✓ Library load: 95th percentile = 185ms (< 200ms)
✓ Search operations: 90th percentile = 420ms (< 500ms)
✓ Ownership checks: 95th percentile = 85ms (< 100ms)
✓ Throughput: 1200 concurrent users supported
✓ Error rate: 0.3% (< 1%)

Recommendations:
- System is performing well within acceptable parameters
- Cache hit rate could be improved (current: 72%)
- Consider increasing connection pool size during peak hours
```

## Continuous Performance Testing

### CI/CD Integration
Performance tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Performance Tests
  run: |
    npm run docker:dev
    npm run perf:test:basic
    npm run perf:benchmark
```

### Automated Monitoring
The performance optimizer service runs automatically:
- Refreshes materialized views every 30 minutes
- Warms cache every 5 minutes
- Monitors system resources every minute
- Optimizes indexes hourly

### Performance Regression Detection
- Baseline performance metrics are tracked
- Automated alerts for performance degradation
- Trend analysis for capacity planning
- Performance budgets for new features

## Best Practices

### Load Testing
1. Start with realistic user scenarios
2. Gradually increase load to find breaking points
3. Test with production-like data volumes
4. Monitor all system components during tests

### Database Performance
1. Use appropriate indexes for query patterns
2. Monitor and optimize slow queries
3. Implement proper connection pooling
4. Use materialized views for expensive aggregations

### Caching Strategy
1. Cache frequently accessed data
2. Use appropriate TTL values
3. Implement smart cache invalidation
4. Monitor cache hit rates

### Application Performance
1. Implement proper error handling
2. Use bulk operations for large datasets
3. Monitor memory usage and prevent leaks
4. Implement circuit breakers for external services

## Conclusion

The Library Service performance testing infrastructure provides comprehensive coverage of all performance aspects, from basic load testing to advanced optimization strategies. The automated monitoring and optimization features ensure the service maintains optimal performance as it scales.

Regular performance testing and monitoring help identify potential issues before they impact users and provide data-driven insights for capacity planning and optimization efforts.