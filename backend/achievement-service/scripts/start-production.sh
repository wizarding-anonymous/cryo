#!/bin/bash

# Production startup script for Achievement Service
set -e

echo "Starting Achievement Service in production mode..."

# Check required environment variables
required_vars=(
    "DATABASE_PASSWORD"
    "JWT_SECRET"
    "CORS_ORIGIN"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: Required environment variable $var is not set"
        exit 1
    fi
done

# Create logs directory if it doesn't exist
mkdir -p logs

# Set production environment
export NODE_ENV=production

# Set Node.js production optimizations
export NODE_OPTIONS="--max-old-space-size=2048 --optimize-for-size"
export UV_THREADPOOL_SIZE=16

# Run database migrations
echo "Running database migrations..."
npm run migration:run

# Start the application
echo "Starting Achievement Service..."
exec node dist/main.js