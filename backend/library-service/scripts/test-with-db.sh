#!/bin/bash

# Script to run tests with PostgreSQL database

echo "🚀 Starting test database..."
docker-compose -f docker-compose.test.yml up -d

echo "⏳ Waiting for database to be ready..."
sleep 10

# Check if database is ready
echo "🔍 Checking database connection..."
until docker exec library-service-postgres-test pg_isready -U postgres; do
  echo "Database is not ready yet, waiting..."
  sleep 2
done

echo "✅ Database is ready!"

# Run tests
echo "🧪 Running tests..."
if [ "$1" = "e2e" ]; then
  npm run test:e2e
elif [ "$1" = "unit" ]; then
  npm run test
elif [ "$1" = "coverage" ]; then
  npm run test:cov
else
  echo "Running all tests..."
  npm run test && npm run test:e2e
fi

# Capture test exit code
TEST_EXIT_CODE=$?

# Cleanup
echo "🧹 Cleaning up test database..."
docker-compose -f docker-compose.test.yml down

# Exit with test result
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "✅ All tests passed!"
else
  echo "❌ Tests failed!"
fi

exit $TEST_EXIT_CODE