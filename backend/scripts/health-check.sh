#!/bin/bash

# Health check script for all microservices
# This script checks the health of all services and reports their status

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Configuration
TIMEOUT=10
RETRY_COUNT=3
RETRY_DELAY=2

# Service definitions
declare -A SERVICES=(
    ["api-gateway"]="3000"
    ["user-service"]="3001"
    ["game-catalog-service"]="3002"
    ["library-service"]="3003"
    ["review-service"]="3004"
    ["payment-service"]="3005"
    ["notification-service"]="3006"
    ["social-service"]="3007"
    ["achievement-service"]="3008"
    ["security-service"]="3009"
    ["download-service"]="3010"
)

declare -A INFRASTRUCTURE=(
    ["postgres-user"]="5432"
    ["postgres-catalog"]="5433"
    ["postgres-library"]="5434"
    ["postgres-review"]="5435"
    ["postgres-payment"]="5436"
    ["postgres-notification"]="5437"
    ["postgres-social"]="5438"
    ["postgres-achievement"]="5439"
    ["postgres-security"]="5440"
    ["postgres-download"]="5441"
    ["redis"]="6379"
    ["prometheus"]="9090"
    ["grafana"]="3100"
    ["elasticsearch"]="9200"
    ["kibana"]="5601"
)

# Function to check HTTP endpoint
check_http_endpoint() {
    local service=$1
    local port=$2
    local endpoint=${3:-"/health"}
    
    for i in $(seq 1 $RETRY_COUNT); do
        if curl -f -s --connect-timeout $TIMEOUT "http://localhost:$port$endpoint" > /dev/null 2>&1; then
            return 0
        fi
        
        if [ $i -lt $RETRY_COUNT ]; then
            sleep $RETRY_DELAY
        fi
    done
    
    return 1
}

# Function to check TCP port
check_tcp_port() {
    local service=$1
    local port=$2
    
    for i in $(seq 1 $RETRY_COUNT); do
        if nc -z localhost $port 2>/dev/null; then
            return 0
        fi
        
        if [ $i -lt $RETRY_COUNT ]; then
            sleep $RETRY_DELAY
        fi
    done
    
    return 1
}

# Function to check Docker container
check_container() {
    local container=$1
    
    if docker ps --format "table {{.Names}}" | grep -q "^$container$"; then
        local status=$(docker inspect --format='{{.State.Health.Status}}' $container 2>/dev/null || echo "no-health-check")
        
        case $status in
            "healthy")
                return 0
                ;;
            "unhealthy")
                return 2
                ;;
            "starting")
                return 3
                ;;
            "no-health-check")
                # Check if container is running
                if docker inspect --format='{{.State.Running}}' $container 2>/dev/null | grep -q "true"; then
                    return 0
                else
                    return 1
                fi
                ;;
            *)
                return 1
                ;;
        esac
    else
        return 1
    fi
}

# Main health check function
main() {
    print_header "Microservices Health Check"
    
    local total_services=0
    local healthy_services=0
    local unhealthy_services=0
    local starting_services=0
    
    # Check microservices
    print_header "Microservices Status"
    
    for service in "${!SERVICES[@]}"; do
        local port=${SERVICES[$service]}
        total_services=$((total_services + 1))
        
        printf "%-25s " "$service"
        
        # Check container status first
        check_container "$service"
        local container_status=$?
        
        case $container_status in
            0)
                # Container is running, check HTTP endpoint
                if check_http_endpoint "$service" "$port"; then
                    print_success "Healthy (HTTP OK)"
                    healthy_services=$((healthy_services + 1))
                else
                    print_error "Unhealthy (HTTP Failed)"
                    unhealthy_services=$((unhealthy_services + 1))
                fi
                ;;
            2)
                print_error "Unhealthy (Container Unhealthy)"
                unhealthy_services=$((unhealthy_services + 1))
                ;;
            3)
                print_warning "Starting (Container Starting)"
                starting_services=$((starting_services + 1))
                ;;
            *)
                print_error "Down (Container Not Running)"
                unhealthy_services=$((unhealthy_services + 1))
                ;;
        esac
    done
    
    # Check infrastructure services
    print_header "Infrastructure Status"
    
    for service in "${!INFRASTRUCTURE[@]}"; do
        local port=${INFRASTRUCTURE[$service]}
        total_services=$((total_services + 1))
        
        printf "%-25s " "$service"
        
        # Check container status first
        check_container "$service"
        local container_status=$?
        
        case $container_status in
            0)
                # Container is running, check port
                if check_tcp_port "$service" "$port"; then
                    print_success "Healthy (Port Open)"
                    healthy_services=$((healthy_services + 1))
                else
                    print_error "Unhealthy (Port Closed)"
                    unhealthy_services=$((unhealthy_services + 1))
                fi
                ;;
            2)
                print_error "Unhealthy (Container Unhealthy)"
                unhealthy_services=$((unhealthy_services + 1))
                ;;
            3)
                print_warning "Starting (Container Starting)"
                starting_services=$((starting_services + 1))
                ;;
            *)
                print_error "Down (Container Not Running)"
                unhealthy_services=$((unhealthy_services + 1))
                ;;
        esac
    done
    
    # Summary
    print_header "Health Check Summary"
    
    echo "Total Services: $total_services"
    print_success "Healthy: $healthy_services"
    
    if [ $starting_services -gt 0 ]; then
        print_warning "Starting: $starting_services"
    fi
    
    if [ $unhealthy_services -gt 0 ]; then
        print_error "Unhealthy: $unhealthy_services"
    fi
    
    # Overall status
    if [ $unhealthy_services -eq 0 ] && [ $starting_services -eq 0 ]; then
        print_success "All services are healthy!"
        exit 0
    elif [ $unhealthy_services -eq 0 ]; then
        print_warning "Some services are still starting..."
        exit 1
    else
        print_error "Some services are unhealthy!"
        exit 2
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --retry-count)
            RETRY_COUNT="$2"
            shift 2
            ;;
        --retry-delay)
            RETRY_DELAY="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --timeout SECONDS       Connection timeout (default: $TIMEOUT)"
            echo "  --retry-count COUNT     Number of retries (default: $RETRY_COUNT)"
            echo "  --retry-delay SECONDS   Delay between retries (default: $RETRY_DELAY)"
            echo "  -h, --help              Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check if required tools are available
if ! command -v curl &> /dev/null; then
    print_error "curl is required but not installed"
    exit 1
fi

if ! command -v nc &> /dev/null; then
    print_error "netcat (nc) is required but not installed"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    print_error "docker is required but not installed"
    exit 1
fi

# Run main function
main