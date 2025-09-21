#!/bin/bash

# Generate SSL certificates for development
# This script creates self-signed certificates for local development

set -e

echo "🔐 Generating SSL certificates for development..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Create SSL directory
SSL_DIR="nginx/ssl"
mkdir -p "$SSL_DIR"

# Certificate configuration
COUNTRY="US"
STATE="State"
CITY="City"
ORGANIZATION="Development"
ORGANIZATIONAL_UNIT="IT Department"
COMMON_NAME="localhost"
EMAIL="admin@localhost"

print_status "Creating SSL certificate for $COMMON_NAME..."

# Generate private key
openssl genrsa -out "$SSL_DIR/key.pem" 2048

# Generate certificate signing request
openssl req -new -key "$SSL_DIR/key.pem" -out "$SSL_DIR/cert.csr" -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORGANIZATION/OU=$ORGANIZATIONAL_UNIT/CN=$COMMON_NAME/emailAddress=$EMAIL"

# Generate self-signed certificate
openssl x509 -req -days 365 -in "$SSL_DIR/cert.csr" -signkey "$SSL_DIR/key.pem" -out "$SSL_DIR/cert.pem"

# Clean up CSR file
rm "$SSL_DIR/cert.csr"

# Set appropriate permissions
chmod 600 "$SSL_DIR/key.pem"
chmod 644 "$SSL_DIR/cert.pem"

print_status "SSL certificates generated successfully!"
print_status "Certificate: $SSL_DIR/cert.pem"
print_status "Private key: $SSL_DIR/key.pem"
print_warning "These are self-signed certificates for development only!"
print_warning "Do not use these certificates in production!"

echo ""
print_status "To use HTTPS in development:"
print_status "1. Uncomment the HTTPS server block in nginx/nginx.conf"
print_status "2. Restart the nginx container"
print_status "3. Access https://localhost (you'll need to accept the self-signed certificate)"