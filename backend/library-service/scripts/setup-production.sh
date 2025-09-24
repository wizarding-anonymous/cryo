#!/bin/bash

# Production setup script for Library Service
# This script helps set up the production environment with proper security

set -e

echo "🚀 Setting up Library Service for Production"
echo "============================================"

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

print_status "Docker and Docker Compose are installed ✓"

# Create secrets directory if it doesn't exist
if [ ! -d "secrets" ]; then
    mkdir -p secrets
    print_status "Created secrets directory"
fi

# Generate secure passwords if they don't exist
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Database password
if [ ! -f "secrets/database_password.txt" ]; then
    generate_password > secrets/database_password.txt
    print_status "Generated database password"
else
    print_warning "Database password already exists"
fi

# JWT secret
if [ ! -f "secrets/jwt_secret.txt" ]; then
    generate_password > secrets/jwt_secret.txt
    print_status "Generated JWT secret"
else
    print_warning "JWT secret already exists"
fi

# Redis password
if [ ! -f "secrets/redis_password.txt" ]; then
    generate_password > secrets/redis_password.txt
    print_status "Generated Redis password"
else
    print_warning "Redis password already exists"
fi

# Set proper permissions on secrets
chmod 600 secrets/*.txt
print_status "Set secure permissions on secret files"

# Create SSL directory if it doesn't exist
if [ ! -d "config/ssl" ]; then
    mkdir -p config/ssl
    print_status "Created SSL directory"
fi

# Generate self-signed SSL certificate for development/testing
if [ ! -f "config/ssl/cert.pem" ] || [ ! -f "config/ssl/key.pem" ]; then
    print_warning "Generating self-signed SSL certificate for testing"
    print_warning "Replace with proper SSL certificates in production!"
    
    openssl req -x509 -newkey rsa:4096 -keyout config/ssl/key.pem -out config/ssl/cert.pem -days 365 -nodes \
        -subj "/C=RU/ST=Moscow/L=Moscow/O=Gaming Platform/OU=Library Service/CN=localhost"
    
    print_status "Generated self-signed SSL certificate"
else
    print_warning "SSL certificates already exist"
fi

# Set proper permissions on SSL files
chmod 600 config/ssl/key.pem
chmod 644 config/ssl/cert.pem
print_status "Set secure permissions on SSL files"

# Create environment file for production
if [ ! -f ".env.production" ]; then
    cat > .env.production << EOF
# Production Environment Configuration
NODE_ENV=production

# Database Configuration
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_NAME=library_service
DATABASE_SYNCHRONIZE=false
DATABASE_LOGGING=false
DATABASE_SSL=true

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_TTL=600

# Service URLs (Update these with your actual service URLs)
GAMES_CATALOG_SERVICE_URL=https://game-catalog.yourdomain.com
USER_SERVICE_URL=https://user-service.yourdomain.com
PAYMENT_SERVICE_URL=https://payment-service.yourdomain.com

# Application Configuration
LOG_LEVEL=info
PROMETHEUS_ENABLED=true
HEALTH_CHECK_TIMEOUT=3000

# APM Configuration
APM_ENABLED=true
APM_SERVICE_NAME=library-service
APM_ENVIRONMENT=production

# Security Configuration
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
    print_status "Created production environment file"
else
    print_warning "Production environment file already exists"
fi

# Build production image
print_status "Building production Docker image..."
docker build --target production -t library-service:prod .
print_status "Production image built successfully ✓"

# Run security check on the image
print_status "Running security check on the image..."
if command -v docker-bench-security &> /dev/null; then
    docker run --rm -it --net host --pid host --userns host --cap-add audit_control \
        -e DOCKER_CONTENT_TRUST=$DOCKER_CONTENT_TRUST \
        -v /etc:/etc:ro \
        -v /usr/bin/containerd:/usr/bin/containerd:ro \
        -v /usr/bin/runc:/usr/bin/runc:ro \
        -v /usr/lib/systemd:/usr/lib/systemd:ro \
        -v /var/lib:/var/lib:ro \
        -v /var/run/docker.sock:/var/run/docker.sock:ro \
        --label docker_bench_security \
        docker/docker-bench-security
else
    print_warning "docker-bench-security not found. Consider running security audit manually."
fi

# Test the production setup
print_status "Testing production setup..."
if docker-compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
    print_status "Production docker-compose configuration is valid ✓"
else
    print_error "Production docker-compose configuration has errors"
    exit 1
fi

echo ""
echo "🎉 Production setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Update service URLs in .env.production"
echo "2. Replace self-signed SSL certificates with proper ones"
echo "3. Review and adjust resource limits in docker-compose.prod.yml"
echo "4. Set up monitoring and logging infrastructure"
echo "5. Configure backup strategies for data volumes"
echo ""
echo "To start the production environment:"
echo "docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "To monitor the services:"
echo "docker-compose -f docker-compose.prod.yml logs -f"
echo ""
print_warning "Remember to keep your secrets secure and never commit them to version control!"