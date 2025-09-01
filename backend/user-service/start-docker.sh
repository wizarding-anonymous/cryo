#!/bin/bash

echo "Starting User Service with Docker..."

# Stop any existing containers
echo "Stopping existing containers..."
docker-compose down

# Remove old containers and volumes if needed
echo "Cleaning up old containers..."
docker-compose rm -f

# Build and start services
echo "Building and starting services..."
docker-compose up --build -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 10

# Check service status
echo "Checking service status..."
docker-compose ps

echo "User Service should be available at http://localhost:3001"
echo "API Documentation: http://localhost:3001/api-docs"
echo ""
echo "To view logs: docker-compose logs -f user-service"
echo "To stop services: docker-compose down"