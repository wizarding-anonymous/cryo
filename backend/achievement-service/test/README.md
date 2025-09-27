# Achievement Service Tests

This directory contains comprehensive test suites for the Achievement Service, covering integration tests, performance tests, and error handling scenarios.

## Test Structure

### Core Test Files
- `achievement.e2e-spec.ts` - Basic API endpoint tests
- `integration.e2e-spec.ts` - Multi-user integration scenarios
- `full-flow-integration.e2e-spec.ts` - Complete event → progress → achievement flows
- `performance.e2e-spec.ts` - Performance, load, and stress testing
- `error-handling.e2e-spec.ts` - Basic error handling scenarios
- `comprehensive-error-handling.e2e-spec.ts` - Advanced error handling and edge cases
- `integration-mvp.e2e-spec.ts` - MVP integration tests with other services
- `app.e2e-spec.ts` - Basic application health tests

### Test Configuration Files
- `jest-e2e.json` - Main e2e test configuration
- `jest-integration.json` - Integration test specific configuration
- `jest-performance.json` - Performance test specific configuration
- `test-setup.ts` - Global test setup and teardown
- `test-database.config.ts` - Test database configuration
- `test-database-setup.ts` - Database setup utilities
- `test-utils.ts` - Test utilities and helper functions

## Quick Start

1. **Start the test database:**
   ```bash
   # Using npm script (recommended)
   npm run test:db:start
   
   # Or using Docker Compose directly
   docker-compose -f docker-compose.test.yml up -d
   
   # On Windows, you can also use:
   scripts\start-test-db.bat
   ```

2. **Run the tests:**
   ```bash
   npm run test:e2e
   ```

3. **Stop the test database when done:**
   ```bash
   npm run test:db:stop
   ```

## Running Tests

### Prerequisites
- Docker and Docker Compose installed
- Node.js and npm installed

### Basic Commands
```bash
# Start test database
npm run test:db:start

# Run all e2e tests
npm run test:e2e

# Run integration tests only
npm run test:integration

# Run performance tests only
npm run test:performance

# Run error handling tests only
npm run test:error-handling

# Run full flow tests only
npm run test:full-flow

# Run with coverage
npm run test:e2e:cov

# Run in watch mode
npm run test:e2e:watch
npm run test:integration:watch
npm run test:performance:watch

# View database logs
npm run test:db:logs

# Stop test database
npm run test:db:stop
```

### Advanced Commands
```bash
# Run specific test file
npm run test:e2e -- achievement.e2e-spec.ts

# Run tests matching pattern
npm run test:e2e -- --testNamePattern="Performance"

# Run tests with verbose output
npm run test:e2e -- --verbose

# Run tests with specific timeout
npm run test:e2e -- --testTimeout=120000
```

## Test Database Setup

The tests use a containerized PostgreSQL database for isolation and consistency.

### Automatic Setup (Recommended)
```bash
npm run test:db:start
```

This will:
- Start PostgreSQL on port 5433
- Start Redis on port 6380 (for caching tests)
- Wait for the database to be ready

### Manual Setup
If you prefer to set up the database manually:

```bash
docker run --name achievement-test-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=achievement_service_test \
  -p 5433:5432 \
  -d postgres:15-alpine
```

## Environment Configuration

The tests automatically load configuration from `.env.test`. This file is created automatically with default values:

```
NODE_ENV=test
TEST_DB_HOST=localhost
TEST_DB_PORT=5433
TEST_DB_USERNAME=postgres
TEST_DB_PASSWORD=password
TEST_DB_NAME=achievement_service_test
```

You can modify these values if needed for your environment.

## Test Categories

### 1. Integration Tests
**Purpose:** Test complete flows from event to achievement unlock
**Files:** `full-flow-integration.e2e-spec.ts`, `integration.e2e-spec.ts`
**Coverage:**
- Event → Progress Update → Achievement Unlock flow
- Multi-user scenarios
- Concurrent event processing
- Data consistency verification
- Complex multi-event flows

### 2. Performance Tests
**Purpose:** Validate system performance under load
**Files:** `performance.e2e-spec.ts`
**Coverage:**
- Large dataset handling (100+ achievements, 1000+ users)
- Concurrent request processing (1000+ simultaneous requests)
- Cache effectiveness testing
- Database query optimization
- Memory and resource usage
- Burst traffic patterns

### 3. Error Handling Tests
**Purpose:** Ensure robust error handling and edge case management
**Files:** `error-handling.e2e-spec.ts`, `comprehensive-error-handling.e2e-spec.ts`
**Coverage:**
- Input validation (UUID formats, event types, data structures)
- Database constraint violations
- Network and protocol edge cases
- Security scenarios (SQL injection, XSS, path traversal)
- Resource exhaustion scenarios
- Data consistency under stress

### 4. MVP Integration Tests
**Purpose:** Test integration with other MVP services
**Files:** `integration-mvp.e2e-spec.ts`
**Coverage:**
- Payment Service integration
- Review Service integration
- Social Service integration
- Library Service integration
- Notification Service integration

## Performance Benchmarks

### Expected Performance Metrics
- **API Response Time:** < 200ms for standard requests
- **Concurrent Users:** Support 1000+ simultaneous users
- **Event Processing:** 100+ events/second
- **Database Queries:** < 500ms for complex joins
- **Cache Hit Rate:** > 80% for frequently accessed data

### Load Testing Scenarios
- **Burst Traffic:** 100 requests in 1 second
- **Sustained Load:** 1000 requests over 30 seconds
- **Large Dataset:** 1000+ users with 50+ achievements each
- **Complex Events:** Large event data (1MB+ payloads)

## Test Data

Tests use the `TestDataFactory` to create consistent test data. The database is automatically:
- Seeded with test achievements before each test suite
- Cleaned up after each test to ensure isolation
- Completely reset between test runs

## Troubleshooting

### Database Connection Issues
If tests fail with connection errors:

1. Ensure the test database is running:
   ```bash
   docker ps | grep achievement-service-test-db
   ```

2. Check database logs:
   ```bash
   npm run test:db:logs
   ```

3. Restart the database:
   ```bash
   npm run test:db:stop
   npm run test:db:start
   ```

### Port Conflicts
If port 5433 is already in use, you can:
1. Stop the conflicting service
2. Or modify the port in `.env.test` and `docker-compose.test.yml`

### Test Timeouts
Tests have a 30-second timeout. If tests are timing out:
1. Check if the database is responding
2. Ensure your system has sufficient resources
3. Consider running tests with `--maxWorkers=1` for better stability

## Debugging Tests

To debug tests:

```bash
# Debug specific test
npm run test:debug -- --testNamePattern="your test name"

# Run tests with verbose output
npm run test:e2e -- --verbose

# Run single test file with detailed output
npm run test:e2e -- achievement.e2e-spec.ts --verbose
```