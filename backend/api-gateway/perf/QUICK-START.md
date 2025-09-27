# Quick Start - MVP Performance Testing

## Prerequisites

1. **Install Artillery globally** (recommended):
   ```bash
   npm install -g artillery
   ```

2. **Or use npx** (will install on first use):
   ```bash
   npx artillery --version
   ```

## MVP Performance Testing - Quick Guide

### 1. Validate Setup
```bash
# Check if everything is configured correctly
npm run perf:validate

# Test basic Artillery functionality
npm run perf:test-setup
```

### 2. Start API Gateway
```bash
# Development mode
npm run start:dev

# Or with Docker
npm run docker:dev
```

### 3. Run MVP Performance Tests

#### Quick MVP Test (recommended for development)
```bash
npm run perf:mvp-quick
```
- Duration: ~10 minutes
- Tests 1000 concurrent users
- Validates <200ms response time
- Skips extended stability test

#### Full MVP Test Suite
```bash
npm run perf:mvp-all
```
- Duration: ~45 minutes
- Includes extended stability testing
- Complete MVP validation

#### Individual Tests
```bash
# Quick smoke test (30 seconds)
npm run perf:smoke

# MVP load test only
npm run perf:mvp

# Extended stability test
npm run perf:stability
```

## MVP Requirements Validation

The performance tests validate these MVP requirements:

✅ **1000 Concurrent Users**: System handles 1000 simultaneous users
✅ **Response Time < 200ms**: 95th percentile response time under 200ms  
✅ **System Stability**: Remains stable under sustained MVP load

## Test Results

Results are saved in `perf/results/`:
- **JSON files**: Raw test data
- **HTML files**: Visual reports (open in browser)

## Troubleshooting

### Common Issues

1. **Artillery not found**:
   ```bash
   npm install -g artillery
   ```

2. **Service not available**:
   - Ensure API Gateway is running on port 3001
   - Check `http://localhost:3001/health`

3. **High response times**:
   - Check system resources (CPU, memory)
   - Verify Redis is running
   - Check database connections

### Performance Targets

- **p50 (median)**: < 100ms
- **p95**: < 200ms (MVP requirement)
- **p99**: < 400ms
- **Error rate**: < 1%

## Next Steps

After successful performance testing:

1. Review HTML reports for detailed metrics
2. Document any performance issues found
3. Optimize bottlenecks if needed
4. Integrate tests into CI/CD pipeline

For detailed documentation, see `perf/README.md`.