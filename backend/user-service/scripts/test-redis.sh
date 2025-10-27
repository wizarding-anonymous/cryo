#!/bin/bash

echo "🔍 Testing Redis connection from User Service container..."

# Load environment variables
if [ -f .env.docker ]; then
    export $(cat .env.docker | grep -v '^#' | xargs)
fi

# Test Redis connection using redis-cli
echo "Testing Redis with redis-cli..."
redis-cli -h ${REDIS_HOST:-redis} -p ${REDIS_PORT:-6379} -a ${REDIS_PASSWORD:-redis_password} ping

if [ $? -eq 0 ]; then
    echo "✅ Redis ping successful"
else
    echo "❌ Redis ping failed"
    exit 1
fi

# Test Redis operations
echo "Testing Redis operations..."
redis-cli -h ${REDIS_HOST:-redis} -p ${REDIS_PORT:-6379} -a ${REDIS_PASSWORD:-redis_password} set test:connection success EX 60
redis-cli -h ${REDIS_HOST:-redis} -p ${REDIS_PORT:-6379} -a ${REDIS_PASSWORD:-redis_password} get test:connection
redis-cli -h ${REDIS_HOST:-redis} -p ${REDIS_PORT:-6379} -a ${REDIS_PASSWORD:-redis_password} del test:connection

echo "🎉 Redis connection test completed successfully!"