#!/bin/bash

# Auth Service Setup Script
# This script sets up the Auth Service for development or production

set -e

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

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    print_error "This script must be run from the auth-service directory"
    exit 1
fi

# Check if backend directory exists
if [ ! -f "../docker-compose.yml" ]; then
    print_error "Backend docker-compose.yml not found. Make sure you're in the correct directory structure."
    exit 1
fi

# Parse command line arguments
MODE=${1:-"development"}
SKIP_DEPS=${2:-"false"}

print_status "Setting up Auth Service in $MODE mode..."

# Install dependencies
if [ "$SKIP_DEPS" != "true" ]; then
    print_status "Installing dependencies..."
    npm ci
    print_success "Dependencies installed"
else
    print_warning "Skipping dependency installation"
fi

# Setup environment file
if [ ! -f ".env" ]; then
    print_status "Creating .env file from template..."
    cp .env.example .env
    print_success "Environment file created"
    print_warning "Please review and update .env file with your configuration"
else
    print_warning ".env file already exists, skipping creation"
fi

# Setup based on mode
case $MODE in
    "development"|"dev")
        print_status "Setting up development environment..."
        
        # Start database services
        print_status "Starting database services..."
        cd ..
        docker-compose up -d postgres-auth redis
        cd auth-service
        
        # Wait for database to be ready
        print_status "Waiting for database to be ready..."
        sleep 10
        
        # Initialize database
        print_status "Initializing database..."
        npm run db:init
        
        print_success "Development setup complete!"
        print_status "You can now run: npm run start:dev"
        ;;
        
    "docker"|"docker-dev")
        print_status "Setting up Docker development environment..."
        
        cd ..
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres-auth redis
        
        print_status "Waiting for services to be ready..."
        sleep 15
        
        # Build and start auth service
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d auth-service
        
        print_success "Docker development setup complete!"
        print_status "Auth Service is running at http://localhost:3001"
        ;;
        
    "production"|"prod")
        print_status "Setting up production environment..."
        
        # Build the application
        print_status "Building application..."
        npm run build
        
        cd ..
        
        # Start production services
        print_status "Starting production services..."
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres-auth redis auth-service
        
        print_success "Production setup complete!"
        print_status "Auth Service is running at http://localhost:3001"
        ;;
        
    "test")
        print_status "Setting up test environment..."
        
        # Start test database
        cd ..
        docker-compose up -d postgres-auth redis
        cd auth-service
        
        # Wait for database
        sleep 10
        
        # Initialize test database
        npm run db:init
        
        # Run tests
        print_status "Running tests..."
        npm run test
        npm run test:e2e
        
        print_success "Test setup and execution complete!"
        ;;
        
    *)
        print_error "Unknown mode: $MODE"
        print_status "Available modes: development, docker, production, test"
        exit 1
        ;;
esac

# Health check
print_status "Performing health check..."
sleep 5

if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    print_success "Auth Service is healthy and responding!"
else
    print_warning "Health check failed. Service might still be starting up."
    print_status "You can check the status with: docker-compose logs auth-service"
fi

print_success "Auth Service setup completed successfully!"

# Show useful commands
echo ""
print_status "Useful commands:"
echo "  View logs:           docker-compose logs -f auth-service"
echo "  Check health:        curl http://localhost:3001/api/health"
echo "  Database status:     npm run db:status"
echo "  Stop services:       docker-compose down"
echo "  Restart service:     docker-compose restart auth-service"