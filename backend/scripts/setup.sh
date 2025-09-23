#!/bin/bash

# Setup script for all microservices
# This script initializes the development environment

set -e

echo "🚀 Setting up microservices development environment..."

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

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if Go is installed
if ! command -v go &> /dev/null; then
    print_warning "Go is not installed. Download service will not work properly."
fi

print_status "Installing dependencies for all Node.js services..."

# List of Node.js services
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

# Install dependencies for each Node.js service
for service in "${NODE_SERVICES[@]}"; do
    if [ -d "$service" ]; then
        print_status "Installing dependencies for $service..."
        cd "$service"
        npm install --legacy-peer-deps
        cd ..
    else
        print_warning "Service directory $service not found, skipping..."
    fi
done

# Install Go dependencies for download service
if [ -d "download-service" ] && command -v go &> /dev/null; then
    print_status "Installing dependencies for download-service..."
    cd download-service
    go mod download
    cd ..
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/grafana/datasources
mkdir -p logging
mkdir -p nginx
mkdir -p k8s
mkdir -p scripts/backup
mkdir -p scripts/deploy

# Copy example environment files
print_status "Setting up environment files..."
for service in "${NODE_SERVICES[@]}"; do
    if [ -d "$service" ] && [ -f "$service/.env.example" ]; then
        if [ ! -f "$service/.env" ]; then
            cp "$service/.env.example" "$service/.env"
            print_status "Created .env file for $service"
        fi
    fi
done

# Setup download service environment
if [ -d "download-service" ] && [ -f "download-service/.env.example" ]; then
    if [ ! -f "download-service/.env" ]; then
        cp "download-service/.env.example" "download-service/.env"
        print_status "Created .env file for download-service"
    fi
fi

# Build Docker images
print_status "Building Docker images..."
docker-compose build

print_status "✅ Setup completed successfully!"
print_status ""
print_status "Next steps:"
print_status "1. Review and update .env files in each service directory"
print_status "2. Run 'make dev' to start the development environment"
print_status "3. Run 'make health' to check if all services are running"
print_status ""
print_status "Available commands:"
print_status "- make dev     : Start development environment"
print_status "- make prod    : Start production environment"
print_status "- make test    : Run tests for all services"
print_status "- make logs    : View logs for all services"
print_status "- make clean   : Clean up containers and volumes"
print_status "- make help    : Show all available commands"