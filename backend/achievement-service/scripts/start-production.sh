#!/bin/bash

# Production startup script for Achievement Service

set -e

echo "Starting Achievement Service in production mode..."

# Check required environment variables
required_vars=(
  "DATABASE_HOST"
  "DATABASE_NAME" 
  "DATABASE_USER"
  "DATABASE_PASSWORD"
  "JWT_SECRET"
  "REDIS_HOST"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "Error: Required environment variable $var is not set"
    exit 1
  fi
done

# Create logs directory
mkdir -p logs

# Set production environment
export NODE_ENV=production

# Run database migrations
echo "Running database migrations..."
npm run migration:run

# Start the application
echo "Starting Achievement Service..."
exec node dist/main.js