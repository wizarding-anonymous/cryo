#!/bin/bash

# Script to run integration and e2e tests with proper infrastructure setup

set -e

echo "🚀 Starting Security Service Test Suite"

# Function to cleanup on exit
cleanup() {
    echo "🧹 Cleaning up test infrastructure..."
    docker-compose -f docker-compose.test.yml down -v
}

# Set trap to cleanup on script exit
trap cleanup EXIT

# Start test infrastructure
echo "🐳 Starting test infrastructure (PostgreSQL + Redis)..."
docker-compose -f docker-compose.test.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if PostgreSQL is ready
echo "🔍 Checking PostgreSQL connection..."
until docker exec security-postgres-test pg_isready -U postgres; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done

# Check if Redis is ready
echo "🔍 Checking Redis connection..."
until docker exec security-redis-test redis-cli ping; do
    echo "Waiting for Redis..."
    sleep 2
done

echo "✅ Test infrastructure is ready!"

# Load environment variables for tests
export NODE_ENV=test
export DB_HOST=localhost
export DB_PORT=5436
export DB_USER=postgres
export DB_PASSWORD=postgres
export DB_NAME=security_service_test
export REDIS_HOST=localhost
export REDIS_PORT=6382

# Run different test suites based on argument
case "${1:-all}" in
    "unit")
        echo "🧪 Running unit tests..."
        npm run test
        ;;
    "integration")
        echo "🔗 Running integration tests..."
        npm run test:integration
        ;;
    "e2e")
        echo "🌐 Running e2e tests..."
        npm run test:e2e
        ;;
    "performance")
        echo "⚡ Running performance tests..."
        npm run test:performance
        ;;
    "error-handling")
        echo "🚨 Running error handling tests..."
        npm run test:error-handling
        ;;
    "all")
        echo "🎯 Running all tests..."
        echo "📋 1/5 Unit tests..."
        npm run test
        echo "📋 2/5 Integration tests..."
        npm run test:integration
        echo "📋 3/5 E2E tests..."
        npm run test:e2e
        echo "📋 4/5 Performance tests..."
        npm run test:performance
        echo "📋 5/5 Error handling tests..."
        npm run test:error-handling
        ;;
    *)
        echo "❌ Unknown test suite: $1"
        echo "Available options: unit, integration, e2e, performance, error-handling, all"
        exit 1
        ;;
esac

echo "✅ Test suite completed successfully!"