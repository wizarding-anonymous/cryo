#!/bin/bash

# User Service Development Setup Script
# This script sets up the development environment for User Service with full microservices integration

set -e

echo "🚀 Setting up User Service development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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

print_header() {
    echo -e "${PURPLE}[SETUP]${NC} $1"
}

print_command() {
    echo -e "${CYAN}[CMD]${NC} $1"
}

# Parse command line arguments
SETUP_MODE="minimal"
SKIP_DEPS=false
SKIP_MIGRATION=false
ENABLE_MONITORING=false
ENABLE_LOGGING=false
ENABLE_AUTH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --full)
            SETUP_MODE="full"
            shift
            ;;
        --with-auth)
            ENABLE_AUTH=true
            shift
            ;;
        --with-monitoring)
            ENABLE_MONITORING=true
            shift
            ;;
        --with-logging)
            ENABLE_LOGGING=true
            shift
            ;;
        --skip-deps)
            SKIP_DEPS=true
            shift
            ;;
        --skip-migration)
            SKIP_MIGRATION=true
            shift
            ;;
        --help)
            echo "User Service Development Setup Script"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --full              Start all microservices (full development environment)"
            echo "  --with-auth         Include Auth Service in setup"
            echo "  --with-monitoring   Include Prometheus and Grafana"
            echo "  --with-logging      Include ELK stack for logging"
            echo "  --skip-deps         Skip npm dependency installation"
            echo "  --skip-migration    Skip database migration"
            echo "  --help              Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                          # Minimal setup (User Service + dependencies)"
            echo "  $0 --full                   # Full microservices environment"
            echo "  $0 --with-auth              # User Service + Auth Service"
            echo "  $0 --with-monitoring        # User Service + monitoring stack"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

print_header "Development Environment Setup - Mode: $SETUP_MODE"

# Check if Docker is running
print_status "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

print_status "Checking current directory..."
if [[ ! -f "package.json" ]]; then
    print_error "This script must be run from the user-service directory"
    exit 1
fi

# Install dependencies
if [[ "$SKIP_DEPS" == false ]]; then
    print_status "Installing Node.js dependencies..."
    npm ci --legacy-peer-deps
else
    print_warning "Skipping dependency installation"
fi

# Create environment file if it doesn't exist
if [[ ! -f ".env.docker" ]]; then
    print_status "Creating .env.docker file..."
    cat > .env.docker << EOF
# User Service Configuration
NODE_ENV=development
USER_SERVICE_PORT=3002
USER_SERVICE_HOST=0.0.0.0

# Database Configuration
DB_HOST=postgres-user
DB_PORT=5432
DB_USER=user_service
DB_PASSWORD=user_password
DB_NAME=user_db
DB_SSL_MODE=disable
DATABASE_URL=postgresql://user_service:user_password@postgres-user:5432/user_db

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
REDIS_URL=redis://:redis_password@redis:6379

# JWT Configuration (for testing)
JWT_SECRET=dev-secret-key-change-in-production

# Logging
LOG_LEVEL=debug

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090

# Security
API_KEY_HEADER=x-api-key
INTERNAL_API_KEY=dev-internal-api-key

# External Services (for development)
AUTH_SERVICE_URL=http://auth-service:3001
SECURITY_SERVICE_URL=http://security-service:3010
NOTIFICATION_SERVICE_URL=http://notification-service:3007
EOF
    print_success "Created .env.docker file"
else
    print_warning ".env.docker already exists, skipping creation"
fi

# Determine which services to start based on setup mode
print_status "Determining services to start..."
cd ../

SERVICES_TO_START="postgres-user redis"

if [[ "$SETUP_MODE" == "full" ]]; then
    print_status "Starting full microservices environment..."
    SERVICES_TO_START=""  # Start all services
elif [[ "$ENABLE_AUTH" == true ]]; then
    SERVICES_TO_START="$SERVICES_TO_START postgres-auth auth-service"
fi

if [[ "$ENABLE_MONITORING" == true ]]; then
    SERVICES_TO_START="$SERVICES_TO_START prometheus grafana"
fi

if [[ "$ENABLE_LOGGING" == true ]]; then
    SERVICES_TO_START="$SERVICES_TO_START elasticsearch kibana logstash"
fi

# Always include user-service
SERVICES_TO_START="$SERVICES_TO_START user-service"

# Start Docker Compose services
if [[ "$SETUP_MODE" == "full" ]]; then
    print_command "docker-compose up -d"
    docker-compose up -d
else
    print_command "docker-compose up -d $SERVICES_TO_START"
    docker-compose up -d $SERVICES_TO_START
fi

print_status "Waiting for services to be ready..."
sleep 45

# Check service health
print_status "Checking service health..."

# Check PostgreSQL
print_status "Checking PostgreSQL..."
if docker-compose exec -T postgres-user pg_isready -U user_service -d user_db > /dev/null 2>&1; then
    print_success "PostgreSQL (User DB) is ready"
else
    print_error "PostgreSQL (User DB) is not ready"
    exit 1
fi

# Check Auth PostgreSQL if enabled
if [[ "$ENABLE_AUTH" == true ]] || [[ "$SETUP_MODE" == "full" ]]; then
    print_status "Checking Auth PostgreSQL..."
    if docker-compose exec -T postgres-auth pg_isready -U auth_service -d auth_db > /dev/null 2>&1; then
        print_success "PostgreSQL (Auth DB) is ready"
    else
        print_warning "PostgreSQL (Auth DB) is not ready"
    fi
fi

# Check Redis
print_status "Checking Redis..."
if docker-compose exec -T redis redis-cli -a redis_password ping > /dev/null 2>&1; then
    print_success "Redis is ready"
else
    print_error "Redis is not ready"
    exit 1
fi

# Check User Service
print_status "Waiting for User Service to be ready..."
timeout 90 bash -c 'until curl -f http://localhost:3002/health > /dev/null 2>&1; do echo "Waiting for User Service..."; sleep 5; done'

if curl -f http://localhost:3002/health > /dev/null 2>&1; then
    print_success "User Service is ready"
else
    print_error "User Service is not responding"
    exit 1
fi

# Check Auth Service if enabled
if [[ "$ENABLE_AUTH" == true ]] || [[ "$SETUP_MODE" == "full" ]]; then
    print_status "Checking Auth Service..."
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        print_success "Auth Service is ready"
    else
        print_warning "Auth Service is not responding"
    fi
fi

# Run database migrations
if [[ "$SKIP_MIGRATION" == false ]]; then
    print_status "Running database migrations..."
    cd user-service/
    npm run migration:run
else
    print_warning "Skipping database migration"
    cd user-service/
fi

print_success "🎉 User Service development environment is ready!"
print_header "Services Status"

# Core services
print_status "Core Services:"
print_status "  ✅ User Service: http://localhost:3002"
print_status "  ✅ PostgreSQL (User): localhost:5433"
print_status "  ✅ Redis: localhost:6379"

# Optional services
if [[ "$ENABLE_AUTH" == true ]] || [[ "$SETUP_MODE" == "full" ]]; then
    print_status "  ✅ Auth Service: http://localhost:3001"
    print_status "  ✅ PostgreSQL (Auth): localhost:5432"
fi

if [[ "$ENABLE_MONITORING" == true ]] || [[ "$SETUP_MODE" == "full" ]]; then
    print_status "  📊 Prometheus: http://localhost:9090"
    print_status "  📈 Grafana: http://localhost:3100 (admin/admin)"
fi

if [[ "$ENABLE_LOGGING" == true ]] || [[ "$SETUP_MODE" == "full" ]]; then
    print_status "  🔍 Kibana: http://localhost:5601"
    print_status "  📋 Elasticsearch: http://localhost:9200"
fi

if [[ "$SETUP_MODE" == "full" ]]; then
    print_status "  🚪 API Gateway: http://localhost:3000"
    print_status "  🎮 Game Catalog: http://localhost:3003"
    print_status "  📚 Library Service: http://localhost:3004"
    print_status "  💳 Payment Service: http://localhost:3006"
fi

print_header "Development Commands"
print_status "Docker Management:"
print_status "  - View logs: npm run dev:full:logs"
print_status "  - Stop all: npm run dev:full:down"
print_status "  - Restart User Service: npm run dev:full:restart"
print_status "  - Check status: npm run dev:full:status"
print_status ""
print_status "Development:"
print_status "  - Run tests: npm run test"
print_status "  - Run in dev mode: npm run start:dev"
print_status "  - Run migrations: npm run migration:run"
print_status "  - Seed database: npm run db:seed"
print_status ""
print_status "Monitoring & Debug:"
print_status "  - Check health: npm run monitoring:health"
print_status "  - View metrics: npm run monitoring:metrics"
print_status "  - Debug Redis: npm run debug:redis"
print_status "  - Debug PostgreSQL: npm run debug:postgres"
print_status ""
print_status "Performance:"
print_status "  - Load test: npm run perf:load-test"
print_status "  - Memory usage: npm run perf:memory"

print_header "Quick Start"
print_status "1. Test the service: curl http://localhost:3002/health"
print_status "2. View API docs: http://localhost:3002/api"
print_status "3. Start development: npm run start:dev"