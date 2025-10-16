#!/bin/bash

# User Service Monitoring and Debug Script
# Provides various monitoring and debugging utilities

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}[MONITOR]${NC} $1"
}

print_metric() {
    echo -e "${CYAN}[METRIC]${NC} $1"
}

# Function to check service health
check_health() {
    print_header "Service Health Check"
    
    # User Service
    print_status "Checking User Service..."
    if curl -s -f http://localhost:3002/health > /dev/null; then
        HEALTH_RESPONSE=$(curl -s http://localhost:3002/health | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
        print_success "User Service: $HEALTH_RESPONSE"
    else
        print_error "User Service: Not responding"
    fi
    
    # PostgreSQL
    print_status "Checking PostgreSQL..."
    cd ../
    if docker-compose exec -T postgres-user pg_isready -U user_service -d user_db > /dev/null 2>&1; then
        print_success "PostgreSQL: Ready"
    else
        print_error "PostgreSQL: Not ready"
    fi
    
    # Redis
    print_status "Checking Redis..."
    if docker-compose exec -T redis redis-cli -a redis_password ping > /dev/null 2>&1; then
        print_success "Redis: Ready"
    else
        print_error "Redis: Not ready"
    fi
    
    cd user-service/
}

# Function to show metrics
show_metrics() {
    print_header "Service Metrics"
    
    print_status "Fetching Prometheus metrics..."
    if curl -s http://localhost:3002/metrics > /dev/null; then
        echo ""
        print_metric "HTTP Requests:"
        curl -s http://localhost:3002/metrics | grep "http_requests_total" | head -5
        
        echo ""
        print_metric "Response Times:"
        curl -s http://localhost:3002/metrics | grep "http_request_duration" | head -5
        
        echo ""
        print_metric "User Service Specific:"
        curl -s http://localhost:3002/metrics | grep "user_service" | head -10
        
        echo ""
        print_metric "Cache Metrics:"
        curl -s http://localhost:3002/metrics | grep "cache" | head -5
        
        echo ""
        print_metric "Database Metrics:"
        curl -s http://localhost:3002/metrics | grep "database" | head -5
    else
        print_error "Could not fetch metrics from User Service"
    fi
}

# Function to show logs
show_logs() {
    local LINES=${1:-50}
    local FOLLOW=${2:-false}
    
    print_header "Service Logs (last $LINES lines)"
    
    cd ../
    if [[ "$FOLLOW" == "true" ]]; then
        print_status "Following logs (Ctrl+C to stop)..."
        docker-compose logs -f --tail=$LINES user-service
    else
        docker-compose logs --tail=$LINES user-service
    fi
    cd user-service/
}

# Function to show container stats
show_stats() {
    print_header "Container Statistics"
    
    cd ../
    print_status "Docker container stats:"
    docker stats --no-stream user-service postgres-user redis 2>/dev/null || print_warning "Some containers may not be running"
    
    echo ""
    print_status "Container details:"
    docker-compose ps user-service postgres-user redis
    cd user-service/
}

# Function to show database info
show_database_info() {
    print_header "Database Information"
    
    cd ../
    print_status "Database connections:"
    docker-compose exec -T postgres-user psql -U user_service -d user_db -c "
        SELECT 
            datname,
            numbackends as active_connections,
            xact_commit as transactions_committed,
            xact_rollback as transactions_rolled_back,
            blks_read as blocks_read,
            blks_hit as blocks_hit,
            tup_returned as tuples_returned,
            tup_fetched as tuples_fetched,
            tup_inserted as tuples_inserted,
            tup_updated as tuples_updated,
            tup_deleted as tuples_deleted
        FROM pg_stat_database 
        WHERE datname = 'user_db';
    " 2>/dev/null || print_error "Could not fetch database stats"
    
    echo ""
    print_status "Table sizes:"
    docker-compose exec -T postgres-user psql -U user_service -d user_db -c "
        SELECT 
            schemaname,
            tablename,
            attname,
            n_distinct,
            correlation
        FROM pg_stats 
        WHERE schemaname = 'public'
        ORDER BY tablename, attname;
    " 2>/dev/null || print_error "Could not fetch table stats"
    
    echo ""
    print_status "Recent migrations:"
    docker-compose exec -T postgres-user psql -U user_service -d user_db -c "
        SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 5;
    " 2>/dev/null || print_warning "Could not fetch migration history"
    
    cd user-service/
}

# Function to show Redis info
show_redis_info() {
    print_header "Redis Information"
    
    cd ../
    print_status "Redis info:"
    docker-compose exec -T redis redis-cli -a redis_password info server 2>/dev/null | grep -E "(redis_version|uptime_in_seconds|connected_clients|used_memory_human|keyspace_hits|keyspace_misses)" || print_error "Could not fetch Redis info"
    
    echo ""
    print_status "Redis keyspace:"
    docker-compose exec -T redis redis-cli -a redis_password info keyspace 2>/dev/null || print_warning "No keyspace data"
    
    echo ""
    print_status "User Service keys (sample):"
    docker-compose exec -T redis redis-cli -a redis_password --scan --pattern "user-service:*" 2>/dev/null | head -10 || print_warning "No user-service keys found"
    
    cd user-service/
}

# Function to run diagnostics
run_diagnostics() {
    print_header "Running Full Diagnostics"
    
    check_health
    echo ""
    show_stats
    echo ""
    show_database_info
    echo ""
    show_redis_info
    echo ""
    show_metrics
}

# Function to test endpoints
test_endpoints() {
    print_header "Testing API Endpoints"
    
    local BASE_URL="http://localhost:3002"
    
    # Health check
    print_status "Testing health endpoint..."
    if curl -s -f "$BASE_URL/health" > /dev/null; then
        HEALTH=$(curl -s "$BASE_URL/health" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
        print_success "GET /health: $HEALTH"
    else
        print_error "GET /health: Failed"
    fi
    
    # Metrics
    print_status "Testing metrics endpoint..."
    if curl -s -f "$BASE_URL/metrics" > /dev/null; then
        METRIC_COUNT=$(curl -s "$BASE_URL/metrics" | wc -l)
        print_success "GET /metrics: $METRIC_COUNT lines"
    else
        print_error "GET /metrics: Failed"
    fi
    
    # API documentation
    print_status "Testing API docs..."
    if curl -s -f "$BASE_URL/api" > /dev/null; then
        print_success "GET /api: Available"
    else
        print_warning "GET /api: Not available"
    fi
    
    # Test user endpoints (with mock data)
    print_status "Testing user endpoints..."
    
    # Try to get a user (should return 404 for non-existent user)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/users/550e8400-e29b-41d4-a716-446655440000")
    if [[ "$HTTP_CODE" == "404" ]]; then
        print_success "GET /users/:id: Properly returns 404 for non-existent user"
    elif [[ "$HTTP_CODE" == "200" ]]; then
        print_success "GET /users/:id: Returns 200 (user exists)"
    else
        print_warning "GET /users/:id: Unexpected status code $HTTP_CODE"
    fi
}

# Function to show help
show_help() {
    echo "User Service Monitoring and Debug Script"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  health              Check service health"
    echo "  metrics             Show Prometheus metrics"
    echo "  logs [lines] [follow]  Show logs (default: 50 lines, follow: true/false)"
    echo "  stats               Show container statistics"
    echo "  database            Show database information"
    echo "  redis               Show Redis information"
    echo "  diagnostics         Run full diagnostics"
    echo "  test                Test API endpoints"
    echo "  help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 health"
    echo "  $0 logs 100"
    echo "  $0 logs 50 true    # Follow logs"
    echo "  $0 diagnostics"
    echo "  $0 test"
}

# Main script logic
case "${1:-help}" in
    "health")
        check_health
        ;;
    "metrics")
        show_metrics
        ;;
    "logs")
        show_logs "${2:-50}" "${3:-false}"
        ;;
    "stats")
        show_stats
        ;;
    "database")
        show_database_info
        ;;
    "redis")
        show_redis_info
        ;;
    "diagnostics")
        run_diagnostics
        ;;
    "test")
        test_endpoints
        ;;
    "help"|*)
        show_help
        ;;
esac