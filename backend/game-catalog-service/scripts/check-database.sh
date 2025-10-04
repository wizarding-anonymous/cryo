#!/bin/bash

# Database connection check script for Game Catalog Service
# This script verifies database connectivity before running migrations

set -e

echo "🔍 Checking database connection for Game Catalog Service..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Default values if not set
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_USER=${POSTGRES_USER:-catalog_service}
POSTGRES_DB=${POSTGRES_DB:-catalog_db}

echo "📋 Connection details:"
echo "  Host: $POSTGRES_HOST"
echo "  Port: $POSTGRES_PORT"
echo "  User: $POSTGRES_USER"
echo "  Database: $POSTGRES_DB"

# Test connection using Node.js
echo "🔌 Testing database connection..."

node -e "
const { DataSource } = require('typeorm');

const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || '$POSTGRES_HOST',
    port: parseInt(process.env.POSTGRES_PORT || '$POSTGRES_PORT'),
    username: process.env.POSTGRES_USER || '$POSTGRES_USER',
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB || '$POSTGRES_DB',
});

dataSource.initialize()
    .then(() => {
        console.log('✅ Database connection successful!');
        return dataSource.destroy();
    })
    .then(() => {
        console.log('📋 Ready to run migrations with: npm run migration:run');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Database connection failed:', error.message);
        console.log('💡 Please check:');
        console.log('  - Database server is running');
        console.log('  - Connection parameters are correct');
        console.log('  - Network connectivity');
        process.exit(1);
    });
"