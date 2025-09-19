# Achievement Service Tests

This directory contains all tests for the Achievement Service.

## Test Structure

- `achievement.e2e-spec.ts` - Main API endpoint tests
- `integration.e2e-spec.ts` - Full integration flow tests
- `error-handling.e2e-spec.ts` - Error handling and edge case tests
- `performance.e2e-spec.ts` - Performance and load tests
- `test-utils.ts` - Test utilities and data factories
- `test-database.config.ts` - Test database configuration

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

### Commands
```bash
# Start test database
npm run test:db:start

# Run all e2e tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- achievement.e2e-spec.ts

# Run specific test by name
npm run test:e2e -- --testNamePattern="should return all achievements"

# Run tests with coverage
npm run test:e2e:cov

# Run tests in watch mode
npm run test:e2e:watch

# Run integration tests only
npm run test:integration

# Run performance tests only
npm run test:performance

# View database logs
npm run test:db:logs

# Stop test database
npm run test:db:stop
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