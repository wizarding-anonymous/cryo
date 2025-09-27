#!/bin/bash

# Health check script for production deployment
# This script performs comprehensive health checks

set -e

HOST="${HOST:-localhost}"
PORT="${PORT:-3001}"
TIMEOUT="${HEALTH_CHECK_TIMEOUT:-10}"

echo "🏥 Performing health check on $HOST:$PORT..."

# Basic health endpoint check
echo "🔍 Checking basic health endpoint..."
if ! curl -f -s --max-time $TIMEOUT "http://$HOST:$PORT/api/health" > /dev/null; then
    echo "❌ Health endpoint failed"
    exit 1
fi

# Check readiness endpoint
echo "🔍 Checking readiness endpoint..."
if ! curl -f -s --max-time $TIMEOUT "http://$HOST:$PORT/api/health/ready" > /dev/null; then
    echo "❌ Readiness endpoint failed"
    exit 1
fi

# Check metrics endpoint (if available)
echo "🔍 Checking metrics endpoint..."
if curl -f -s --max-time $TIMEOUT "http://$HOST:$PORT/api/metrics" > /dev/null; then
    echo "✅ Metrics endpoint available"
else
    echo "⚠️  Metrics endpoint not available (non-critical)"
fi

echo "✅ All health checks passed"
exit 0