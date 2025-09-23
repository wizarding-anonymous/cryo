# Integration Tests Documentation

This document describes the comprehensive integration tests implemented for the Library Service, covering all requirements from task 16.

## Test Files Overview

### 1. `auth.e2e-spec.ts` - Authentication & Authorization Tests
Tests all authentication and authorization flows:

**JWT Authentication:**
- Validates JWT token presence and format
- Tests expired token handling
- Validates required JWT claims
- Tests malformed token rejection

**Role-based Authorization:**
- Tests user role access to endpoints
- Tests admin role permissions
- Handles tokens with missing roles

**Security Features:**
- Cross-user access prevention
- Token manipulation protection
- Internal authentication for service-to-service calls

### 2. `search-filtering.e2e-spec.ts` - Search and Filtering Tests
Comprehensive search and filtering functionality:

**Library Search:**
- Exact and partial title matching
- Search by developer, publisher, and tags
- Case-insensitive search
- Special character handling
- Query validation (min/max length)

**Filtering and Sorting:**
- Sort by purchase date, title, developer
- Ascending/descending order
- Invalid parameter handling

**Pagination:**
- Search result pagination
- Deep pagination performance
- Parameter validation

**Purchase History Search:**
- Search in purchase history
- History pagination
- Empty result handling

### 3. `external-services.e2e-spec.ts` - External Service Integration Tests
Tests integration with all external services:

**Game Catalog Service:**
- Game data enrichment
- Service unavailability handling
- Partial data handling
- Timeout management
- Game existence validation

**User Service:**
- User existence validation
- Service failure handling
- Retry mechanisms

**Payment Service:**
- Purchase validation
- Invalid purchase rejection
- Circuit breaker patterns

**Service Resilience:**
- Multiple service failure handling
- Response caching
- Format change adaptation
- Timeout implementation

### 4. `error-handling.e2e-spec.ts` - Error Handling Tests
Comprehensive error handling scenarios:

**Validation Errors (400):**
- Invalid UUID parameters
- Invalid pagination parameters
- Missing required fields
- Invalid data types
- Currency format validation
- Date format validation
- Negative values

**Not Found Errors (404):**
- Non-existent resources
- User not found scenarios
- Game not found scenarios

**Conflict Errors (409):**
- Duplicate game additions

**Server Errors (503/500):**
- External service unavailability
- Database connection errors
- Timeout handling

**Security Tests:**
- SQL injection prevention
- XSS attack prevention
- Large payload handling
- Malformed JSON handling

**Error Response Format:**
- Consistent error structure
- Correlation ID inclusion
- Sensitive information protection

### 5. `performance.e2e-spec.ts` - Performance Tests
Performance and scalability testing:

**Large Library Performance:**
- 1000+ games handling
- Pagination efficiency
- Response time validation

**Search Performance:**
- Complex query handling
- Large dataset search
- Concurrent search requests

**Concurrent Request Handling:**
- Multiple simultaneous requests
- Memory leak prevention
- Resource usage monitoring

**Database Query Performance:**
- Efficient query execution
- Complex filtering performance
- Sorting optimization

## Test Coverage

### API Endpoints Tested
- `GET /api/library/my` - User library retrieval
- `GET /api/library/my/search` - Library search
- `GET /api/library/ownership/:gameId` - Ownership check
- `POST /api/library/add` - Add game (internal)
- `DELETE /api/library/remove` - Remove game (internal)
- `GET /api/library/user/:userId/games` - User games (internal)
- `GET /api/library/history` - Purchase history
- `GET /api/library/history/search` - History search
- `GET /api/library/history/:purchaseId` - Purchase details
- `POST /api/library/history` - Create purchase record (internal)
- `GET /api/health` - Health check
- `GET /api/health/detailed` - Detailed health check

### Authentication Flows Tested
- JWT token validation
- Role-based access control
- Internal service authentication
- Cross-user access prevention
- Token expiration handling

### External Service Integration Tested
- Game Catalog Service integration
- User Service integration
- Payment Service integration
- Service failure scenarios
- Circuit breaker patterns
- Retry mechanisms
- Caching strategies

### Error Scenarios Covered
- All HTTP status codes (400, 401, 403, 404, 409, 500, 503)
- Validation errors
- Business logic errors
- External service failures
- Database connection issues
- Security attack prevention

## Running the Tests

### Prerequisites
The tests are designed to work with or without external dependencies:
- **With Database**: Run `npm run test:e2e:docker` to start PostgreSQL and Redis
- **Without Database**: Tests will skip database-dependent operations gracefully

### Test Commands
```bash
# Run all integration tests
npm run test:e2e

# Run with coverage
npm run test:e2e:cov

# Run with Docker (includes database)
npm run test:e2e:docker

# Run specific test file
npx jest auth.e2e-spec.ts --config ./test/jest-e2e.json
```

### Test Configuration
- Tests use in-memory cache when Redis is unavailable
- Database operations are mocked when PostgreSQL is unavailable
- External services are mocked for consistent testing
- Test isolation through data cleanup

## Test Data Management

### Mock Data
- Comprehensive game catalog mock data
- User service mock responses
- Payment service mock responses
- Realistic test scenarios

### Data Cleanup
- Automatic cleanup between tests
- Isolated test environments
- No test data pollution

## Performance Benchmarks

### Response Time Targets
- Library retrieval: < 200ms (requirement)
- Search operations: < 1000ms
- Pagination: < 800ms
- Concurrent requests: < 500ms average

### Scalability Targets
- 1000+ games in library
- 1000 concurrent users (requirement)
- Complex search queries
- Large result set handling

## Integration with CI/CD

### Test Reliability
- Robust error handling
- Graceful degradation
- Retry mechanisms for flaky operations
- Comprehensive logging

### Coverage Requirements
- 100% endpoint coverage
- All authentication flows
- All error scenarios
- External service integrations

## Future Enhancements

### Planned Additions
- Load testing integration
- Chaos engineering tests
- End-to-end user journey tests
- Performance regression testing

### Monitoring Integration
- Test execution metrics
- Performance trend analysis
- Error rate monitoring
- Service dependency tracking

## Troubleshooting

### Common Issues
1. **Database Connection**: Ensure PostgreSQL is running on port 5433
2. **Redis Connection**: Ensure Redis is running on port 6380 (optional)
3. **Port Conflicts**: Check for conflicting services
4. **Memory Issues**: Increase Node.js memory limit for large tests

### Debug Mode
```bash
# Run tests with debug output
DEBUG=* npm run test:e2e

# Run specific test with verbose output
npx jest auth.e2e-spec.ts --config ./test/jest-e2e.json --verbose
```

This comprehensive integration test suite ensures the Library Service meets all requirements for reliability, performance, and security in a production environment.