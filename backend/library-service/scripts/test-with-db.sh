#!/bin/bash

# Test script with database setup
# This script starts test databases and runs all tests

set -e

# Configuration
COVERAGE=false
E2E=false
UNIT=false
ALL=false
SKIP_CLEANUP=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --coverage      Run tests with coverage"
    echo "  --e2e          Run only e2e tests"
    echo "  --unit         Run only unit tests"
    echo "  --all          Run all tests (default)"
    echo "  --skip-cleanup Don't stop test environment after tests"
    echo "  -h, --help     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run all tests"
    echo "  $0 --unit            # Run only unit tests"
    echo "  $0 --e2e --coverage  # Run e2e tests with coverage"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --coverage)
            COVERAGE=true
            shift
            ;;
        --e2e)
            E2E=true
            shift
            ;;
        --unit)
            UNIT=true
            shift
            ;;
        --all)
            ALL=true
            shift
            ;;
        --skip-cleanup)
            SKIP_CLEANUP=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Function to cleanup test environment
cleanup_test_environment() {
    print_status "Stopping test environment..."
    if docker-compose -f docker-compose.test.yml down -v >/dev/null 2>&1; then
        print_status "Test environment stopped"
    else
        print_warning "Failed to stop test environment"
    fi
}

# Function to start test environment
start_test_environment() {
    print_status "Starting test environment..."
    if docker-compose -f docker-compose.test.yml up -d --wait >/dev/null 2>&1; then
        print_status "Test environment started"
        return 0
    else
        print_error "Failed to start test environment"
        return 1
    fi
}

# Function to wait for services
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        # Check if PostgreSQL is ready
        if docker-compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U postgres -d library_service_test >/dev/null 2>&1; then
            # Check if Redis is ready
            if docker-compose -f docker-compose.test.yml exec -T redis-test redis-cli ping >/dev/null 2>&1; then
                print_status "All services are ready"
                return 0
            fi
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    echo ""
    print_error "Services did not become ready in time"
    return 1
}

# Function to run unit tests
run_unit_tests() {
    print_status "Running unit tests..."
    if [ "$COVERAGE" = true ]; then
        if npm run test:cov; then
            print_status "Unit tests completed successfully"
            return 0
        else
            print_error "Unit tests failed"
            return 1
        fi
    else
        if npm run test; then
            print_status "Unit tests completed successfully"
            return 0
        else
            print_error "Unit tests failed"
            return 1
        fi
    fi
}

# Function to run e2e tests
run_e2e_tests() {
    print_status "Running e2e tests..."
    
    # Set test environment variables
    export NODE_ENV=test
    export DATABASE_HOST=localhost
    export DATABASE_PORT=5433
    export DATABASE_USERNAME=postgres
    export DATABASE_PASSWORD=test_password
    export DATABASE_NAME=library_service_test
    export DATABASE_SYNCHRONIZE=true
    export DATABASE_LOGGING=false
    export REDIS_HOST=localhost
    export REDIS_PORT=6380
    export REDIS_TTL=300
    export JWT_SECRET=test-secret-key
    export GAMES_CATALOG_SERVICE_URL=http://localhost:3011
    export USER_SERVICE_URL=http://localhost:3012
    export PAYMENT_SERVICE_URL=http://localhost:3013
    export LOG_LEVEL=error
    export PROMETHEUS_ENABLED=false
    
    if [ "$COVERAGE" = true ]; then
        if npm run test:e2e:cov; then
            print_status "E2E tests completed successfully"
            return 0
        else
            print_error "E2E tests failed"
            return 1
        fi
    else
        if npm run test:e2e; then
            print_status "E2E tests completed successfully"
            return 0
        else
            print_error "E2E tests failed"
            return 1
        fi
    fi
}

# Cleanup on exit
trap 'if [ "$SKIP_CLEANUP" != true ]; then cleanup_test_environment; fi' EXIT

# Main execution
echo "🧪 Library Service Test Runner"
echo "=============================="
echo ""

tests_passed=true

# Determine which tests to run
if [ "$UNIT" != true ] && [ "$E2E" != true ] && [ "$ALL" != true ]; then
    ALL=true  # Default to running all tests
fi

# Run unit tests (don't need database)
if [ "$UNIT" = true ] || [ "$ALL" = true ]; then
    if ! run_unit_tests; then
        tests_passed=false
    fi
    echo ""
fi

# Run e2e tests (need database)
if [ "$E2E" = true ] || [ "$ALL" = true ]; then
    # Start test environment
    if ! start_test_environment; then
        exit 1
    fi
    
    # Wait for services to be ready
    if ! wait_for_services; then
        cleanup_test_environment
        exit 1
    fi
    
    # Run e2e tests
    if ! run_e2e_tests; then
        tests_passed=false
    fi
fi

echo ""
echo "=============================="

if [ "$tests_passed" = true ]; then
    print_status "All tests passed! 🎉"
    exit 0
else
    print_error "Some tests failed! ❌"
    exit 1
fi