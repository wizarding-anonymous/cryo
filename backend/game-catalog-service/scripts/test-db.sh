#!/bin/bash

# Test database connection script

set -e

echo "🔍 Testing database connection..."

# Load environment variables
if [ -f .env.docker ]; then
    export $(cat .env.docker | grep -v '^#' | xargs)
fi

echo "Database: $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"
echo "User: $POSTGRES_USER"

# Test connection using TypeORM CLI
echo "Testing TypeORM connection..."
npm run typeorm -- query "SELECT version();" || {
    echo "❌ TypeORM connection failed"
    exit 1
}

echo "✅ Database connection successful!"

# Show tables
echo "📋 Current tables:"
npm run typeorm -- query "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"