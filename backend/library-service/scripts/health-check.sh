#!/bin/bash

# Health check script for Library Service
# This script performs comprehensive health checks on all services

set -e

# Configuration
LIBRARY_SERVICE_URL="http://localhost:3000"
TIMEOUT=30
RETRY_COUNT=3
RETRY_DELAY=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

# Function to check HTTP endpoint
check_http_endpoint() {
    local url=$1
    local expected_status=${2:-200}
    local description=$3
    
    print_info "Checking $description..."
    
    for i in $(seq 1 $RETRY_COUNT); do
        if response=$(curl -s -w "%{http_code}" -o /tmp/health_response --max-time $TIMEOUT "$url" 2>/dev/null); then
            if [ "$response" = "$expected_status" ]; then
                print_status "$description is healthy (HTTP $response)"
                return 0
            else
                print_warning "$description returned HTTP $response (expected $expected_status)"
                if [ -f /tmp/health_response ]; then
                    echo "Response body: $(cat /tmp/health_response)"
                fi
            fi
        else
            print_warning "$description is not responding (attempt $i/$RETRY_COUNT)"
        fi
        
        if [ $i -lt $RETRY_COUNT ]; then
            sleep $RETRY_DELAY
        fi
    done
    
    print_error "$description failed health check"
    return 1
}

# Function to check Docker container
check_docker_container() {
    local container_name=$1
    local description=$2
    
    print_info "Checking $description container..."
    
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$container_name.*Up"; then
        print_status "$description container is running"
        return 0
    else
        print_error "$description container is not running"
        return 1
    fi
}

# Function to check database connectivity
check_database() {
    print_info "Checking database connectivity..."
    
    if docker-compose exec -T postgres pg_isready -U postgres -d library_service >/dev/null 2>&1; then
        print_status "Database is accessible"
        return 0
    else
        print_error "Database is not accessible"
        return 1
    fi
}

# Function to check Redis connectivity
check_redis() {
    print_info "Checking Redis connectivity..."
    
    if docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
        print_status "Redis is accessible"
        return 0
    else
        print_error "Redis is not accessible"
        return 1
    fi
}

# Function to check service dependencies
check_dependencies() {
    print_info "Checking service dependencies..."
    
    local deps_healthy=true
    
    # Check database
    if ! check_database; then
        deps_healthy=false
    fi
    
    # Check Redis
    if ! check_redis; then
        deps_healthy=false
    fi
    
    if $deps_healthy; then
        print_status "All dependencies are healthy"
        return 0
    else
        print_error "Some dependencies are unhealthy"
        return 1
    fi
}

# Function to perform comprehensive health check
comprehensive_health_check() {
    local all_healthy=true
    
    echo "🏥 Library Service Health Check"
    echo "==============================="
    echo ""
    
    # Check Docker containers
    if ! check_docker_container "library-service" "Library Service"; then
        all_healthy=false
    fi
    
    if ! check_docker_container "postgres" "PostgreSQL"; then
        all_healthy=false
    fi
    
    if ! check_docker_container "redis" "Redis"; then
        all_healthy=false
    fi
    
    echo ""
    
    # Check service dependencies
    if ! check_dependencies; then
        all_healthy=false
    fi
    
    echo ""
    
    # Check HTTP endpoints
    if ! check_http_endpoint "$LIBRARY_SERVICE_URL/health" 200 "Library Service health endpoint"; then
        all_healthy=false
    fi
    
    if ! check_http_endpoint "$LIBRARY_SERVICE_URL/health/detailed" 200 "Library Service detailed health"; then
        all_healthy=false
    fi
    
    # Check metrics endpoint (may not be enabled in development)
    if check_http_endpoint "$LIBRARY_SERVICE_URL/metrics" 200 "Prometheus metrics endpoint" 2>/dev/null; then
        print_status "Metrics endpoint is available"
    else
        print_warning "Metrics endpoint is not available (may be disabled in development)"
    fi
    
    echo ""
    
    # Check mock services if they exist
    if docker ps --format "table {{.Names}}" | grep -q "game-catalog-mock"; then
        check_http_endpoint "http://localhost:3001/mockserver/status" 200 "Game Catalog Mock"
    fi
    
    if docker ps --format "table {{.Names}}" | grep -q "user-service-mock"; then
        check_http_endpoint "http://localhost:3002/mockserver/status" 200 "User Service Mock"
    fi
    
    if docker ps --format "table {{.Names}}" | grep -q "payment-service-mock"; then
        check_http_endpoint "http://localhost:3003/mockserver/status" 200 "Payment Service Mock"
    fi
    
    echo ""
    echo "==============================="
    
    if $all_healthy; then
        print_status "All health checks passed! 🎉"
        echo ""
        echo "Service Information:"
        echo "- Library Service: $LIBRARY_SERVICE_URL"
        echo "- Health Check: $LIBRARY_SERVICE_URL/health"
        echo "- API Documentation: $LIBRARY_SERVICE_URL/api"
        if curl -s "$LIBRARY_SERVICE_URL/metrics" >/dev/null 2>&1; then
            echo "- Metrics: $LIBRARY_SERVICE_URL/metrics"
        fi
        return 0
    else
        print_error "Some health checks failed! ❌"
        echo ""
        echo "Troubleshooting:"
        echo "1. Check container logs: docker-compose logs -f"
        echo "2. Restart services: docker-compose restart"
        echo "3. Rebuild containers: docker-compose up --build"
        return 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -u, --url URL       Library Service URL (default: http://localhost:3000)"
    echo "  -t, --timeout SEC   Request timeout in seconds (default: 30)"
    echo "  -r, --retries NUM   Number of retries (default: 3)"
    echo "  -d, --delay SEC     Delay between retries (default: 5)"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Basic health check"
    echo "  $0 -u http://localhost:3000          # Custom URL"
    echo "  $0 -t 60 -r 5 -d 10                 # Custom timeout and retries"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            LIBRARY_SERVICE_URL="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -r|--retries)
            RETRY_COUNT="$2"
            shift 2
            ;;
        -d|--delay)
            RETRY_DELAY="$2"
            shift 2
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

# Clean up temporary files on exit
trap 'rm -f /tmp/health_response' EXIT

# Run comprehensive health check
comprehensive_health_check