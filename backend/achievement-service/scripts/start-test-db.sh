#!/bin/bash

# Start test database for achievement service
echo "Starting test database for achievement service..."

# Stop any existing containers
docker-compose -f docker-compose.test.yml down

# Start the test database
docker-compose -f docker-compose.test.yml up -d

# Wait for database to be ready
echo "Waiting for database to be ready..."
timeout 30 bash -c 'until docker exec achievement-service-test-db pg_isready -U postgres; do sleep 1; done'

if [ $? -eq 0 ]; then
    echo "Test database is ready!"
    echo "PostgreSQL: localhost:5433"
    echo "Redis: localhost:6380"
else
    echo "Failed to start test database"
    exit 1
fi