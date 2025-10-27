#!/bin/bash

# Wait for Redis to be ready
REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}
REDIS_PASSWORD=${REDIS_PASSWORD:-redis_password}

echo "Waiting for Redis at $REDIS_HOST:$REDIS_PORT..."

# Function to check Redis connectivity
check_redis() {
    if [ -n "$REDIS_PASSWORD" ]; then
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" ping 2>/dev/null
    else
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null
    fi
}

# Wait up to 60 seconds for Redis to be ready
TIMEOUT=60
COUNTER=0

while [ $COUNTER -lt $TIMEOUT ]; do
    if check_redis | grep -q "PONG"; then
        echo "✅ Redis is ready!"
        exit 0
    fi
    
    echo "⏳ Waiting for Redis... ($COUNTER/$TIMEOUT)"
    sleep 2
    COUNTER=$((COUNTER + 2))
done

echo "❌ Redis is not ready after $TIMEOUT seconds"
exit 1