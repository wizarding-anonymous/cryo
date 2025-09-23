# Load Testing for User Service

This directory contains comprehensive load testing tools for the User Service to verify it can handle 1000+ concurrent users with response times under 200ms.

## 🎯 Performance Requirements

- **Response Time**: < 200ms (95th percentile)
- **Concurrent Users**: 1000+ simultaneous users
- **Error Rate**: < 1%
- **Throughput**: High requests per second
- **Availability**: Health checks remain responsive under load

## 🛠️ Available Load Testing Tools

### 1. Simple Load Test (Node.js) - **Recommended**
**File**: `simple-load-test.js`

A pure Node.js load testing solution that doesn't require external tools.

```bash
# Run the simple load test
node simple-load-test.js

# With custom base URL
BASE_URL=http://your-service:3001 node simple-load-test.js
```

**Features**:
- ✅ No external dependencies
- ✅ 1000+ concurrent users simulation
- ✅ Realistic user scenarios (register, login, profile operations)
- ✅ Detailed performance metrics
- ✅ Requirements validation
- ✅ Progress reporting
- ✅ JSON report generation

### 2. k6 Load Test (Advanced)
**File**: `k6-load-test.js`

Professional load testing with k6 (requires k6 installation).

```bash
# Install k6 first: https://k6.io/docs/getting-started/installation/

# Run k6 load test
BASE_URL=http://localhost:3001 k6 run k6-load-test.js

# With custom output
BASE_URL=http://localhost:3001 k6 run --out json=results.json k6-load-test.js
```

### 3. Artillery Load Test (HTTP-focused)
**File**: `artillery-load-test.yml`

HTTP-focused load testing with Artillery (requires Artillery installation).

```bash
# Install Artillery first: npm install -g artillery

# Run Artillery load test
artillery run artillery-load-test.yml

# With custom target
artillery run --target http://your-service:3001 artillery-load-test.yml
```

### 4. Automated Test Runner
**Files**: `run-load-tests.sh` (Linux/Mac), `run-load-tests.ps1` (Windows)

Automated scripts that run multiple load testing tools and generate comprehensive reports.

```bash
# Linux/Mac
./run-load-tests.sh

# Windows PowerShell
.\run-load-tests.ps1

# With custom URL
BASE_URL=http://your-service:3001 ./run-load-tests.sh
```

## 🚀 Quick Start

### Prerequisites
1. **User Service must be running**:
   ```bash
   cd backend/user-service
   npm run start:dev
   ```

2. **Service should be healthy**:
   ```bash
   curl http://localhost:3001/api/health
   # Should return: {"status":"ok"}
   ```

### Run Load Test

**Option 1: Simple Node.js Test (Recommended)**
```bash
cd backend/user-service/load-test
node simple-load-test.js
```

**Option 2: With External Tools**
```bash
cd backend/user-service/load-test

# If you have k6 installed
k6 run k6-load-test.js

# If you have Artillery installed
artillery run artillery-load-test.yml
```

## 📊 Test Scenarios

All load tests simulate realistic user behavior:

1. **User Registration** (30% of requests)
   - POST `/api/auth/register`
   - Creates new user accounts

2. **User Login** (40% of requests)
   - POST `/api/auth/login`
   - Authenticates existing users

3. **Profile Operations** (20% of requests)
   - GET `/api/users/profile`
   - PUT `/api/users/profile`
   - Requires authentication

4. **Health Checks** (10% of requests)
   - GET `/api/health`
   - System monitoring

## 📈 Load Test Phases

1. **Warm-up**: 10-50 users (1-2 minutes)
2. **Ramp-up**: 50-500 users (2-5 minutes)
3. **Sustained Load**: 500-1000 users (5-10 minutes)
4. **Peak Load**: 1000+ users (10+ minutes)
5. **Cool-down**: Gradual decrease (2 minutes)

## 📋 Results Analysis

### Key Metrics Monitored

1. **Response Time**
   - Average response time
   - 95th percentile (< 200ms target)
   - 99th percentile
   - Maximum response time

2. **Throughput**
   - Requests per second
   - Concurrent users handled
   - Peak throughput achieved

3. **Error Rate**
   - Failed requests percentage (< 1% target)
   - Error types and patterns
   - Success rate by endpoint

4. **System Resources**
   - CPU usage during load
   - Memory consumption
   - Network utilization

### Report Files

Load test results are saved in `./load-test-results/`:

- `load-test-report-[timestamp].json` - Detailed JSON report
- `k6_results_[timestamp].json` - k6 specific results
- `artillery_results_[timestamp].json` - Artillery results
- `artillery_report_[timestamp].html` - Artillery HTML report
- `system_monitor_[timestamp].csv` - System resource monitoring

## ✅ Production Readiness Checklist

After running load tests, verify:

- [ ] **Response Time**: 95th percentile < 200ms ✅
- [ ] **Concurrent Users**: Handles 1000+ users ✅
- [ ] **Error Rate**: < 1% error rate ✅
- [ ] **Stability**: No memory leaks or crashes ✅
- [ ] **Health Checks**: Remain responsive under load ✅
- [ ] **Graceful Degradation**: Performance degrades gracefully ✅
- [ ] **Recovery**: Quick recovery after load removal ✅

## 🔧 Troubleshooting

### Common Issues

1. **Service Not Running**
   ```
   Error: Service health check failed
   Solution: Start the service with `npm run start:dev`
   ```

2. **High Error Rate**
   ```
   Error: Error rate > 1%
   Solution: Check service logs, database connections, resource limits
   ```

3. **Slow Response Times**
   ```
   Error: 95th percentile > 200ms
   Solution: Optimize database queries, add caching, scale resources
   ```

4. **Connection Refused**
   ```
   Error: ECONNREFUSED
   Solution: Verify service URL, check firewall, ensure service is accessible
   ```

### Performance Optimization Tips

1. **Database Optimization**
   - Add database indexes
   - Optimize queries
   - Use connection pooling

2. **Caching**
   - Implement Redis caching
   - Cache JWT validations
   - Cache user profiles

3. **Resource Scaling**
   - Increase CPU/memory limits
   - Scale horizontally with multiple instances
   - Use load balancers

4. **Code Optimization**
   - Optimize hot code paths
   - Reduce unnecessary computations
   - Use async/await properly

## 🎯 Integration with CI/CD

Add load testing to your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Run Load Tests
  run: |
    cd backend/user-service/load-test
    node simple-load-test.js
  env:
    BASE_URL: ${{ env.SERVICE_URL }}
```

## 📚 Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [Artillery Documentation](https://artillery.io/docs/)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [NestJS Performance](https://docs.nestjs.com/techniques/performance)