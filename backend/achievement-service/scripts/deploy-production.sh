#!/bin/bash

# Production Deployment Script for Achievement Service
set -e

echo "🚀 Starting Achievement Service Production Deployment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Do not run this script as root"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

print_status "Step 1: Validating production configuration..."

# Run production validation
if ! node scripts/validate-production-config.js; then
    print_error "Production configuration validation failed"
    exit 1
fi

print_success "Production configuration validation passed"

print_status "Step 2: Running tests..."

# Run all tests
if ! npm run test:all; then
    print_error "Tests failed"
    exit 1
fi

print_success "All tests passed"

print_status "Step 3: Building application..."

# Build the application
if ! npm run build; then
    print_error "Build failed"
    exit 1
fi

print_success "Application built successfully"

print_status "Step 4: Building Docker images..."

# Build production Docker image
if ! docker-compose -f docker-compose.prod.yml build; then
    print_error "Docker build failed"
    exit 1
fi

print_success "Docker images built successfully"

print_status "Step 5: Creating required directories..."

# Create logs directory
mkdir -p logs
mkdir -p logs/.audit

# Create backup directory
mkdir -p scripts/backup

print_success "Directories created"

print_status "Step 6: Stopping existing services..."

# Stop existing services if running
docker-compose -f docker-compose.prod.yml down --remove-orphans || true
docker-compose -f docker-compose.monitoring.yml down --remove-orphans || true

print_success "Existing services stopped"

print_status "Step 7: Starting production services..."

# Start production services
if ! docker-compose -f docker-compose.prod.yml up -d; then
    print_error "Failed to start production services"
    exit 1
fi

print_success "Production services started"

print_status "Step 8: Waiting for services to be ready..."

# Wait for services to be healthy
sleep 30

# Check if services are healthy
if ! docker-compose -f docker-compose.prod.yml ps | grep -q "healthy"; then
    print_warning "Some services may not be healthy yet. Checking individual services..."
    
    # Check each service
    for service in achievement-service-prod achievement-postgres-prod achievement-redis-prod; do
        if docker ps --filter "name=$service" --filter "health=healthy" | grep -q "$service"; then
            print_success "$service is healthy"
        else
            print_warning "$service is not healthy yet"
        fi
    done
fi

print_status "Step 9: Running database migrations..."

# Run database migrations
if ! docker-compose -f docker-compose.prod.yml exec -T achievement-service npm run migration:run; then
    print_error "Database migrations failed"
    exit 1
fi

print_success "Database migrations completed"

print_status "Step 10: Starting monitoring stack..."

# Start monitoring services
if ! docker-compose -f docker-compose.monitoring.yml up -d; then
    print_error "Failed to start monitoring services"
    exit 1
fi

print_success "Monitoring stack started"

print_status "Step 11: Performing health checks..."

# Wait a bit more for everything to settle
sleep 15

# Health check
HEALTH_URL="http://localhost:3003/api/v1/health"
if curl -f -s "$HEALTH_URL" > /dev/null; then
    print_success "Health check passed"
else
    print_error "Health check failed"
    print_status "Checking service logs..."
    docker-compose -f docker-compose.prod.yml logs --tail=50 achievement-service
    exit 1
fi

# Readiness check
READY_URL="http://localhost:3003/api/v1/health/ready"
if curl -f -s "$READY_URL" > /dev/null; then
    print_success "Readiness check passed"
else
    print_warning "Readiness check failed - service may still be starting up"
fi

# Metrics check
METRICS_URL="http://localhost:3003/api/v1/metrics"
if curl -f -s "$METRICS_URL" > /dev/null; then
    print_success "Metrics endpoint is accessible"
else
    print_warning "Metrics endpoint is not accessible"
fi

print_status "Step 12: Deployment summary..."

echo ""
echo "🎉 Achievement Service Production Deployment Complete!"
echo "=================================================="
echo ""
echo "Service Endpoints:"
echo "  - Achievement Service: http://localhost:3003"
echo "  - Health Check: http://localhost:3003/api/v1/health"
echo "  - Metrics: http://localhost:3003/api/v1/metrics"
echo ""
echo "Monitoring Stack:"
echo "  - Prometheus: http://localhost:9090"
echo "  - Grafana: http://localhost:3000 (admin/admin123)"
echo "  - AlertManager: http://localhost:9093"
echo "  - Node Exporter: http://localhost:9100"
echo "  - cAdvisor: http://localhost:8080"
echo ""
echo "Useful Commands:"
echo "  - View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "  - Check status: docker-compose -f docker-compose.prod.yml ps"
echo "  - Stop services: docker-compose -f docker-compose.prod.yml down"
echo "  - Restart service: docker-compose -f docker-compose.prod.yml restart achievement-service"
echo ""

# Show running containers
print_status "Running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
print_success "Deployment completed successfully! 🚀"

# Optional: Run a quick smoke test
read -p "Would you like to run a quick smoke test? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Running smoke test..."
    
    # Test achievement endpoints
    if curl -f -s "http://localhost:3003/api/v1/achievements" > /dev/null; then
        print_success "Achievements endpoint is working"
    else
        print_warning "Achievements endpoint test failed"
    fi
    
    print_success "Smoke test completed"
fi