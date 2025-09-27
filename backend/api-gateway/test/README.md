# API Gateway Integration Tests

This directory contains comprehensive end-to-end (e2e) integration tests for the API Gateway service. These tests verify the complete functionality of the gateway including routing, authentication, caching, rate limiting, error handling, and monitoring.

## Test Structure

### Test Files

- **`gateway.e2e-spec.ts`** - Core gateway functionality tests
  - Request routing and proxying
  - Basic authentication flows
  - Response transformation
  - Health checks

- **`caching.e2e-spec.ts`** - Caching functionality tests
  - Redis cache operations
  - Cache hit/miss scenarios
  - Cache invalidation
  - Cache error handling
  - Performance with caching

- **`security.e2e-spec.ts`** - Security integration tests
  - JWT authentication and validation
  - Rate limiting enforcement
  - Input validation and sanitization
  - CORS policy enforcement
  - Security headers
  - Error handling security

- **`performance.e2e-spec.ts`** - Performance and load tests
  - Response time measurements
  - Concurrent request handling
  - Memory and resource usage
  - Cache performance
  - Error handling performance
  - Metrics collection performance

- **`error-handling.e2e-spec.ts`** - Error handling tests
  - Upstream service errors
  - Authentication errors
  - Rate limiting errors
  - Cache service errors
  - Request validation errors
  - Circuit breaker functionality
  - Error response consistency

- **`monitoring.e2e-spec.ts`** - Monitoring and observability tests
  - Metrics collection
  - Health monitoring
  - Distributed tracing
  - Logging and audit
  - Performance monitoring
  - Alert conditions

### Configuration Files

- **`jest-e2e.json`** - Jest configuration for e2e tests
- **`setup-e2e.ts`** - Test setup and global configuration
- **`.env.test`** - Test environment variables

## Running Tests

### All Integration Tests
```bash
npm run test:e2e
```

### Specific Test Categories
```bash
# Run all integration tests
npm run test:integration

# Run security tests only
npm run test:security

# Run performance tests only
npm run test:performance

# Run monitoring tests only
npm run test:monitoring
```

### Development Mode
```bash
# Watch mode for development
npm run test:e2e:watch

# With coverage
npm run test:e2e:cov
```

### Individual Test Files
```bash
# Run specific test file
npx jest --config ./test/jest-e2e.json test/gateway.e2e-spec.ts

# Run with verbose output
npx jest --config ./test/jest-e2e.json --verbose test/security.e2e-spec.ts
```

## Test Environment Setup

### Prerequisites

1. **Node.js** (>= 18.0.0)
2. **Redis** server running (for cache tests)
3. **Test environment variables** configured in `.env.test`

### Environment Variables

The tests use the following environment variables (configured in `.env.test`):

```env
NODE_ENV=test
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=test-secret-key
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=100
CACHE_TTL=300
UPSTREAM_GAMES_URL=http://localhost:3001
UPSTREAM_USERS_URL=http://localhost:3002
LOG_LEVEL=error
```

### Mock Services

The tests use mocked upstream services via Jest mocks:
- **Axios** - Mocked for upstream HTTP requests
- **Redis** - Mocked for cache operations
- **Auth Service** - Mocked for JWT validation
- **Rate Limiter** - Mocked for rate limiting logic

## Test Categories

### 1. Core Gateway Tests (`gateway.e2e-spec.ts`)

Tests the fundamental gateway functionality:
- ✅ Request routing to upstream services
- ✅ Response proxying and transformation
- ✅ Basic authentication flows
- ✅ Health check endpoints
- ✅ CORS handling
- ✅ Request/response logging

### 2. Caching Tests (`caching.e2e-spec.ts`)

Validates caching behavior:
- ✅ Cache hit/miss scenarios
- ✅ Cache key generation
- ✅ Cache TTL handling
- ✅ Cache invalidation
- ✅ Cache error recovery
- ✅ Performance improvements from caching

### 3. Security Tests (`security.e2e-spec.ts`)

Comprehensive security validation:
- ✅ JWT token validation
- ✅ Rate limiting enforcement
- ✅ Input sanitization (XSS, SQL injection)
- ✅ CORS policy enforcement
- ✅ Security headers
- ✅ Authentication error handling
- ✅ Request logging security

### 4. Performance Tests (`performance.e2e-spec.ts`)

Performance and scalability testing:
- ✅ Response time measurements
- ✅ Concurrent request handling
- ✅ Memory usage monitoring
- ✅ Cache performance impact
- ✅ Error handling performance
- ✅ Resource utilization

### 5. Error Handling Tests (`error-handling.e2e-spec.ts`)

Error scenarios and recovery:
- ✅ Upstream service failures
- ✅ Authentication errors
- ✅ Rate limiting errors
- ✅ Cache service failures
- ✅ Request validation errors
- ✅ Circuit breaker functionality
- ✅ Error response consistency

### 6. Monitoring Tests (`monitoring.e2e-spec.ts`)

Observability and monitoring:
- ✅ Metrics collection (Prometheus format)
- ✅ Health check endpoints
- ✅ Distributed tracing
- ✅ Audit logging
- ✅ Performance monitoring
- ✅ Alert condition detection

## Test Patterns and Best Practices

### Mocking Strategy

The tests use comprehensive mocking to isolate the gateway logic:

```typescript
// Mock external dependencies
jest.mock('axios');
const mockedAxios = axios as unknown as jest.Mock<any, any>;

// Mock internal services
mockAuthService = {
  validateBearerToken: jest.fn(),
};

mockRateLimitService = {
  check: jest.fn(),
};
```

### Test Data Management

Tests use consistent test data patterns:

```typescript
const testUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  roles: ['user'],
  permissions: ['read:profile'],
};

const testGameData = {
  items: [{ id: 1, title: 'Test Game', genre: 'Action' }],
  total: 1,
  page: 1,
  limit: 10,
};
```

### Assertion Patterns

Consistent assertion patterns for different scenarios:

```typescript
// Success response assertions
expect(response.body).toEqual(expectedData);
expect(response.status).toBe(200);
expect(response.headers['content-type']).toContain('application/json');

// Error response assertions
expect(response.body).toEqual({
  statusCode: 401,
  message: 'Unauthorized',
  timestamp: expect.any(String),
  path: expect.any(String),
});

// Metrics assertions
expect(mockMetricsService.incrementRequestCounter).toHaveBeenCalledWith(
  'GET',
  '/api/games',
  200
);
```

### Performance Testing

Performance tests measure and validate timing:

```typescript
const startTime = Date.now();
const response = await request(app.getHttpServer())
  .get('/api/games')
  .expect(200);
const responseTime = Date.now() - startTime;

expect(responseTime).toBeLessThan(200); // Should respond within 200ms
```

## Continuous Integration

### GitHub Actions Integration

The tests are designed to run in CI/CD pipelines:

```yaml
- name: Run Integration Tests
  run: |
    npm run test:e2e
    npm run test:e2e:cov
  env:
    NODE_ENV: test
    REDIS_HOST: localhost
    REDIS_PORT: 6379
```

### Test Reports

Tests generate coverage reports and can output JUnit XML for CI integration:

```bash
# Generate coverage report
npm run test:e2e:cov

# Generate JUnit report
npx jest --config ./test/jest-e2e.json --reporters=jest-junit
```

## Debugging Tests

### Debug Mode

Run tests in debug mode:

```bash
# Debug specific test
node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --config ./test/jest-e2e.json --runInBand test/gateway.e2e-spec.ts

# Debug with VS Code
# Add breakpoints and use "Debug Jest Tests" configuration
```

### Verbose Output

Get detailed test output:

```bash
npx jest --config ./test/jest-e2e.json --verbose --no-cache
```

### Test Isolation

Run tests in isolation to debug issues:

```bash
# Run single test
npx jest --config ./test/jest-e2e.json -t "should handle successful GET requests"

# Run single test file
npx jest --config ./test/jest-e2e.json test/security.e2e-spec.ts
```

## Contributing

### Adding New Tests

1. **Follow naming conventions**: `*.e2e-spec.ts`
2. **Use consistent test structure**: describe blocks for logical grouping
3. **Mock external dependencies**: Keep tests isolated and fast
4. **Add comprehensive assertions**: Test both success and failure cases
5. **Document test purpose**: Clear test descriptions and comments

### Test Categories

When adding new tests, categorize them appropriately:
- **Unit-like tests** → Core functionality
- **Integration tests** → Cross-service interactions
- **Security tests** → Authentication, authorization, validation
- **Performance tests** → Timing, concurrency, resource usage
- **Error tests** → Failure scenarios and recovery
- **Monitoring tests** → Observability and metrics

### Code Quality

- **ESLint compliance**: Follow project linting rules
- **TypeScript strict mode**: Use proper typing
- **Test coverage**: Aim for high coverage of critical paths
- **Performance**: Keep tests fast and efficient
- **Maintainability**: Write clear, readable test code

## Troubleshooting

### Common Issues

1. **Redis connection errors**
   - Ensure Redis is running locally
   - Check Redis configuration in `.env.test`

2. **Port conflicts**
   - Ensure test port (3000) is available
   - Check for running services on test ports

3. **Mock issues**
   - Clear Jest cache: `npx jest --clearCache`
   - Verify mock implementations match actual service interfaces

4. **Timeout errors**
   - Increase Jest timeout for slow tests
   - Check for unresolved promises in tests

5. **Memory leaks**
   - Ensure proper cleanup in `afterEach`/`afterAll`
   - Close database connections and clear timers

### Getting Help

- Check test logs for detailed error messages
- Use `--verbose` flag for detailed test output
- Review mock configurations and test setup
- Ensure all dependencies are properly installed
- Verify environment variables are correctly set

## Metrics and Reporting

The integration tests collect various metrics:

- **Test execution time**
- **Code coverage percentage**
- **Number of assertions**
- **Mock call counts**
- **Performance benchmarks**

These metrics help ensure the gateway maintains high quality and performance standards.