#!/bin/sh

# Entrypoint script for Game Catalog Service
# This script starts the application without running migrations
# Migrations should be run manually using npm run migration:run

set -e

echo "🚀 Starting Game Catalog Service..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if node -e "
        const { DataSource } = require('typeorm');
        const dataSource = new DataSource({
            type: 'postgres',
            host: process.env.POSTGRES_HOST,
            port: parseInt(process.env.POSTGRES_PORT),
            username: process.env.POSTGRES_USER,
            password: process.env.POSTGRES_PASSWORD,
            database: process.env.POSTGRES_DB
        });
        dataSource.initialize().then(() => {
            console.log('Connected');
            process.exit(0);
        }).catch(() => process.exit(1));
    " > /dev/null 2>&1; then
        echo "✅ Database connection successful!"
        break
    else
        echo "⏳ Waiting for database... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    fi
done

if [ $attempt -gt $max_attempts ]; then
    echo "❌ Failed to connect to database after $max_attempts attempts"
    echo "💡 Please ensure database is running and migrations have been executed manually"
    exit 1
fi

# Start the application
echo "🎮 Starting Game Catalog Service application..."
echo "💡 Note: Migrations should be run manually using 'npm run migration:run'"
exec "$@"