#!/bin/bash

# Production startup script for API Gateway
# This script ensures proper production environment setup

set -e

echo "🚀 Starting API Gateway in Production Mode..."

# Check if we're running in production
if [ "$NODE_ENV" != "production" ]; then
    echo "❌ NODE_ENV is not set to 'production'. Current value: $NODE_ENV"
    exit 1
fi

# Validate required environment variables
REQUIRED_VARS=(
    "REDIS_HOST"
    "SERVICE_USER_BASE_URL"
    "SERVICE_GAME_CATALOG_BASE_URL"
    "SERVICE_PAYMENT_BASE_URL"
    "SERVICE_LIBRARY_BASE_URL"
    "SERVICE_NOTIFICATION_BASE_URL"
)

echo "🔍 Validating environment variables..."
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required environment variable $var is not set"
        exit 1
    fi
done

# Create logs directory if it doesn't exist
mkdir -p logs

# Set Node.js production optimizations
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=768 --enable-source-maps}"
export UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-16}"

# Validate that the application can start
echo "🔧 Validating application startup..."
timeout 30s node dist/main.js --validate-only || {
    echo "❌ Application validation failed"
    exit 1
}

echo "✅ Production validation complete"
echo "🌟 Starting API Gateway..."

# Start the application with proper signal handling
exec node dist/main.js