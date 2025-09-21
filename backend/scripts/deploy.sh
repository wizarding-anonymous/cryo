#!/bin/bash

# Deployment script for all microservices
# This script handles deployment to different environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_header() {
    echo -e "${BLUE}[DEPLOY]${NC} $1"
}

# Default values
ENVIRONMENT="development"
SKIP_TESTS=false
SKIP_BUILD=false
BACKUP=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --no-backup)
            BACKUP=false
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -e, --environment ENV    Target environment (development, staging, production)"
            echo "  --skip-tests            Skip running tests before deployment"
            echo "  --skip-build            Skip building Docker images"
            echo "  --no-backup             Skip database backup"
            echo "  -h, --help              Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

print_header "Starting deployment to $ENVIRONMENT environment"

# Validate environment
case $ENVIRONMENT in
    development|dev)
        COMPOSE_FILE="docker-compose.yml -f docker-compose.dev.yml"
        ;;
    staging|stage)
        COMPOSE_FILE="docker-compose.yml -f docker-compose.prod.yml"
        ;;
    production|prod)
        COMPOSE_FILE="docker-compose.yml -f docker-compose.prod.yml"
        ;;
    *)
        print_error "Invalid environment: $ENVIRONMENT"
        print_error "Valid environments: development, staging, production"
        exit 1
        ;;
esac

# Pre-deployment checks
print_status "Running pre-deployment checks..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if required files exist
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml not found in current directory"
    exit 1
fi

# Run tests if not skipped
if [ "$SKIP_TESTS" = false ]; then
    print_status "Running tests..."
    
    # Test Node.js services
    NODE_SERVICES=(
        "api-gateway"
        "user-service"
        "game-catalog-service"
        "library-service"
        "review-service"
        "payment-service"
        "notification-service"
        "social-service"
        "achievement-service"
        "security-service"
    )
    
    for service in "${NODE_SERVICES[@]}"; do
        if [ -d "$service" ]; then
            print_status "Testing $service..."
            cd "$service"
            npm test || {
                print_error "Tests failed for $service"
                exit 1
            }
            cd ..
        fi
    done
    
    # Test Go service
    if [ -d "download-service" ] && command -v go &> /dev/null; then
        print_status "Testing download-service..."
        cd download-service
        go test ./... || {
            print_error "Tests failed for download-service"
            exit 1
        }
        cd ..
    fi
    
    print_status "All tests passed!"
fi

# Create backup if enabled and not development
if [ "$BACKUP" = true ] && [ "$ENVIRONMENT" != "development" ] && [ "$ENVIRONMENT" != "dev" ]; then
    print_status "Creating database backup..."
    mkdir -p backups
    
    # Check if services are running
    if docker-compose ps | grep -q "Up"; then
        make backup || print_warning "Backup failed, continuing with deployment..."
    else
        print_warning "Services not running, skipping backup"
    fi
fi

# Build images if not skipped
if [ "$SKIP_BUILD" = false ]; then
    print_status "Building Docker images..."
    docker-compose -f $COMPOSE_FILE build --no-cache
fi

# Stop existing services
print_status "Stopping existing services..."
docker-compose -f $COMPOSE_FILE down

# Start services
print_status "Starting services in $ENVIRONMENT mode..."
docker-compose -f $COMPOSE_FILE up -d

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 30

# Health check
print_status "Performing health checks..."
HEALTH_CHECK_RETRIES=5
HEALTH_CHECK_DELAY=10

for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
    print_status "Health check attempt $i/$HEALTH_CHECK_RETRIES..."
    
    # Check if all containers are running
    if docker-compose -f $COMPOSE_FILE ps | grep -q "Exit"; then
        print_warning "Some containers have exited, checking logs..."
        docker-compose -f $COMPOSE_FILE logs --tail=50
        
        if [ $i -eq $HEALTH_CHECK_RETRIES ]; then
            print_error "Health check failed after $HEALTH_CHECK_RETRIES attempts"
            exit 1
        fi
        
        sleep $HEALTH_CHECK_DELAY
        continue
    fi
    
    # Check service endpoints
    SERVICES_HEALTHY=true
    
    # API Gateway health check
    if ! curl -f http://localhost:3000/health > /dev/null 2>&1; then
        print_warning "API Gateway health check failed"
        SERVICES_HEALTHY=false
    fi
    
    if [ "$SERVICES_HEALTHY" = true ]; then
        print_status "All services are healthy!"
        break
    fi
    
    if [ $i -eq $HEALTH_CHECK_RETRIES ]; then
        print_error "Health check failed after $HEALTH_CHECK_RETRIES attempts"
        exit 1
    fi
    
    sleep $HEALTH_CHECK_DELAY
done

# Run database migrations for production/staging
if [ "$ENVIRONMENT" = "production" ] || [ "$ENVIRONMENT" = "staging" ]; then
    print_status "Running database migrations..."
    make db-migrate || print_warning "Some migrations may have failed"
fi

# Show deployment summary
print_header "Deployment Summary"
print_status "Environment: $ENVIRONMENT"
print_status "Services deployed:"
docker-compose -f $COMPOSE_FILE ps

print_status ""
print_status "🎉 Deployment completed successfully!"
print_status ""
print_status "Service URLs:"
print_status "- API Gateway: http://localhost:3000"
print_status "- Prometheus: http://localhost:9090"
print_status "- Grafana: http://localhost:3100 (admin/admin)"
print_status "- Kibana: http://localhost:5601"

if [ "$ENVIRONMENT" = "development" ] || [ "$ENVIRONMENT" = "dev" ]; then
    print_status "- PgAdmin: http://localhost:5050 (admin@admin.com/admin)"
    print_status "- Redis Commander: http://localhost:8081"
fi

print_status ""
print_status "Useful commands:"
print_status "- make logs        : View logs for all services"
print_status "- make status      : Check status of all services"
print_status "- make restart     : Restart all services"
print_status "- make down        : Stop all services"