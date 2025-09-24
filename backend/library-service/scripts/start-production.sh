#!/bin/bash

# Production startup script for Library Service
# Features:
# - Environment validation
# - Secrets verification
# - Health checks
# - Graceful startup
# - Process monitoring

set -e

echo "🚀 Starting Library Service in Production Mode..."

# Set production environment
export NODE_ENV=production

# Load production environment variables
if [ -f ".env.production" ]; then
    echo "📋 Loading production environment variables..."
    export $(cat .env.production | grep -v '^#' | xargs)
else
    echo "⚠️  Warning: .env.production file not found"
fi

# Validate required environment variables
echo "🔍 Validating environment configuration..."

required_vars=(
    "DATABASE_HOST"
    "DATABASE_USERNAME" 
    "DATABASE_NAME"
    "REDIS_HOST"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Missing required environment variables:"
    printf '%s\n' "${missing_vars[@]}"
    exit 1
fi

# Validate secrets exist
echo "🔐 Validating secrets..."

required_secrets=(
    "secrets/database-password.txt"
    "secrets/jwt-secret.txt"
)

missing_secrets=()
for secret in "${required_secrets[@]}"; do
    if [ ! -f "$secret" ]; then
        missing_secrets+=("$secret")
    fi
done

if [ ${#missing_secrets[@]} -ne 0 ]; then
    echo "❌ Missing required secrets:"
    printf '%s\n' "${missing_secrets[@]}"
    echo "💡 Run 'npm run docker:setup:prod' to generate secrets"
    exit 1
fi

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs

# Run database migrations
echo "🗄️  Running database migrations..."
npm run migration:run:prod || {
    echo "❌ Database migration failed"
    exit 1
}

# Wait for dependencies
echo "⏳ Waiting for dependencies..."

# Wait for PostgreSQL
echo "🐘 Waiting for PostgreSQL..."
timeout=30
while ! nc -z "$DATABASE_HOST" "$DATABASE_PORT" 2>/dev/null; do
    timeout=$((timeout - 1))
    if [ $timeout -eq 0 ]; then
        echo "❌ PostgreSQL connection timeout"
        exit 1
    fi
    sleep 1
done
echo "✅ PostgreSQL is ready"

# Wait for Redis
echo "🔴 Waiting for Redis..."
timeout=30
while ! nc -z "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null; do
    timeout=$((timeout - 1))
    if [ $timeout -eq 0 ]; then
        echo "❌ Redis connection timeout"
        exit 1
    fi
    sleep 1
done
echo "✅ Redis is ready"

# Pre-flight health check
echo "🏥 Running pre-flight health check..."
node -e "
const { execSync } = require('child_process');
try {
    // Test database connection
    console.log('Testing database connection...');
    execSync('npm run typeorm -- query \"SELECT 1\"', { stdio: 'pipe' });
    console.log('✅ Database connection successful');
    
    console.log('✅ Pre-flight checks passed');
} catch (error) {
    console.error('❌ Pre-flight check failed:', error.message);
    process.exit(1);
}
"

# Start the application
echo "🎯 Starting Library Service..."

# Set process title for monitoring
export PROCESS_TITLE="library-service-prod"

# Start with production optimizations
exec node \
    --title="$PROCESS_TITLE" \
    --max-old-space-size=2048 \
    --optimize-for-size \
    --gc-interval=100 \
    --expose-gc \
    dist/main.js

echo "🎉 Library Service started successfully!"