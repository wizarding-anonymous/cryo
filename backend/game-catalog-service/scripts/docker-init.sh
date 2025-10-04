#!/bin/sh

# Docker initialization script for Game Catalog Service
# This script handles database initialization and service startup

set -e

echo "🚀 Initializing Game Catalog Service..."

# Check if we should run migrations
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "🔄 Running database migrations..."
    ./scripts/run-migrations-docker.sh
else
    echo "⏭️  Skipping migrations (RUN_MIGRATIONS != true)"
    echo "💡 To run migrations, set RUN_MIGRATIONS=true or run manually:"
    echo "   docker-compose exec game-catalog-service ./scripts/run-migrations-docker.sh"
fi

# Wait for Redis if configured
if [ -n "$REDIS_HOST" ]; then
    echo "⏳ Checking Redis connection..."
    max_attempts=30
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if node -e "
            const { Redis } = require('ioredis');
            const redis = new Redis({
                host: process.env.REDIS_HOST,
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD || undefined,
                connectTimeout: 3000,
                lazyConnect: true,
                maxRetriesPerRequest: 1
            });
            
            redis.ping()
                .then(() => {
                    console.log('Redis connected');
                    redis.disconnect();
                    process.exit(0);
                })
                .catch(() => process.exit(1));
        " > /dev/null 2>&1; then
            echo "✅ Redis connection successful!"
            break
        else
            echo "⏳ Waiting for Redis... (attempt $attempt/$max_attempts)"
            sleep 2
            attempt=$((attempt + 1))
        fi
    done
    
    if [ $attempt -gt $max_attempts ]; then
        echo "⚠️  Redis connection failed, but continuing with memory cache fallback"
    fi
else
    echo "⏭️  No Redis configured, using memory cache"
fi

echo "🎮 Starting Game Catalog Service application..."
exec "$@"