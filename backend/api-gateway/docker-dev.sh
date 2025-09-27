#!/bin/bash

# Docker development script for API Gateway
set -e

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

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to build images
build_images() {
    print_status "Building Docker images..."
    docker-compose build --no-cache
    print_status "Images built successfully!"
}

# Function to start services
start_services() {
    print_status "Starting development services..."
    docker-compose up -d
    print_status "Services started successfully!"
    
    # Wait for services to be healthy
    print_status "Waiting for services to be healthy..."
    sleep 10
    
    # Check service health
    check_health
}

# Function to stop services
stop_services() {
    print_status "Stopping development services..."
    docker-compose down
    print_status "Services stopped successfully!"
}

# Function to restart services
restart_services() {
    print_status "Restarting development services..."
    docker-compose restart
    print_status "Services restarted successfully!"
}

# Function to check service health
check_health() {
    print_status "Checking service health..."
    
    services=("api-gateway:3001" "redis:6379" "user-service:3000" "game-catalog-service:3002" "payment-service:3003" "library-service:3004" "notification-service:3005")
    
    for service in "${services[@]}"; do
        name=$(echo $service | cut -d: -f1)
        port=$(echo $service | cut -d: -f2)
        
        if curl -f -s "http://localhost:$port/health" > /dev/null 2>&1; then
            print_status "$name is healthy ✓"
        else
            print_warning "$name is not responding on port $port"
        fi
    done
}

# Function to view logs
view_logs() {
    if [ -z "$1" ]; then
        print_status "Showing logs for all services..."
        docker-compose logs -f
    else
        print_status "Showing logs for $1..."
        docker-compose logs -f "$1"
    fi
}

# Function to clean up
cleanup() {
    print_status "Cleaning up Docker resources..."
    docker-compose down -v --remove-orphans
    docker system prune -f
    print_status "Cleanup completed!"
}

# Function to run tests
run_tests() {
    print_status "Running tests in Docker container..."
    docker-compose exec api-gateway npm run test:e2e
}

# Function to show usage
show_usage() {
    echo "Usage: $0 {build|start|stop|restart|health|logs|cleanup|test|help}"
    echo ""
    echo "Commands:"
    echo "  build     - Build Docker images"
    echo "  start     - Start development services"
    echo "  stop      - Stop development services"
    echo "  restart   - Restart development services"
    echo "  health    - Check service health"
    echo "  logs      - View logs (optionally specify service name)"
    echo "  cleanup   - Clean up Docker resources"
    echo "  test      - Run tests in container"
    echo "  help      - Show this help message"
}

# Main script logic
case "$1" in
    build)
        check_docker
        build_images
        ;;
    start)
        check_docker
        start_services
        ;;
    stop)
        check_docker
        stop_services
        ;;
    restart)
        check_docker
        restart_services
        ;;
    health)
        check_health
        ;;
    logs)
        view_logs "$2"
        ;;
    cleanup)
        check_docker
        cleanup
        ;;
    test)
        check_docker
        run_tests
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        print_error "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac