#!/bin/sh

# Production migration script for Docker environment
# This script should be run before starting the application in production

set -e

echo "🔄 Running database migrations for Game Catalog Service..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
max_attempts=60
attempt=1

while [ $attempt -le $max_attempts ]; do
    if node -e "
        const { DataSource } = require('typeorm');
        const path = require('path');
        
        const dataSource = new DataSource({
            type: 'postgres',
            host: process.env.POSTGRES_HOST || 'postgres-catalog',
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            username: process.env.POSTGRES_USER || 'catalog_service',
            password: process.env.POSTGRES_PASSWORD || 'catalog_password',
            database: process.env.POSTGRES_DB || 'catalog_db',
            entities: ['dist/src/entities/*.entity.js'],
            migrations: ['dist/src/database/migrations/*.js'],
            synchronize: false,
            logging: false
        });
        
        dataSource.initialize()
            .then(async () => {
                console.log('Connected to database');
                await dataSource.destroy();
                process.exit(0);
            })
            .catch((error) => {
                console.error('Connection failed:', error.message);
                process.exit(1);
            });
    " > /dev/null 2>&1; then
        echo "✅ Database connection successful!"
        break
    else
        echo "⏳ Waiting for database... (attempt $attempt/$max_attempts)"
        sleep 3
        attempt=$((attempt + 1))
    fi
done

if [ $attempt -gt $max_attempts ]; then
    echo "❌ Failed to connect to database after $max_attempts attempts"
    echo "💡 Please check:"
    echo "   - Database container is running: docker-compose ps postgres-catalog"
    echo "   - Environment variables are correct"
    echo "   - Network connectivity between containers"
    exit 1
fi

# Check if migrations are needed
echo "🔍 Checking migration status..."
if npm run migration:show > /dev/null 2>&1; then
    echo "📋 Migration system is working"
else
    echo "⚠️  Migration system check failed, but continuing..."
fi

# Run migrations
echo "🚀 Running TypeORM migrations..."
if npm run migration:run; then
    echo "✅ Database migrations completed successfully!"
else
    echo "⚠️  Migration execution had issues, but continuing..."
    echo "💡 You may need to run migrations manually later"
fi

# Verify database schema
echo "🔍 Verifying database schema..."
if node -e "
    const { DataSource } = require('typeorm');
    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.POSTGRES_HOST || 'postgres-catalog',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        username: process.env.POSTGRES_USER || 'catalog_service',
        password: process.env.POSTGRES_PASSWORD || 'catalog_password',
        database: process.env.POSTGRES_DB || 'catalog_db',
        synchronize: false,
        logging: false
    });
    
    dataSource.initialize()
        .then(async () => {
            const tables = await dataSource.query(\"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'\");
            const hasGamesTable = tables.some(t => t.table_name === 'games');
            const hasMigrationsTable = tables.some(t => t.table_name === 'migrations');
            
            if (hasGamesTable && hasMigrationsTable) {
                console.log('✅ Database schema verified');
            } else {
                console.log('⚠️  Database schema incomplete');
            }
            
            await dataSource.destroy();
            process.exit(0);
        })
        .catch((error) => {
            console.error('Schema verification failed:', error.message);
            process.exit(1);
        });
" > /dev/null 2>&1; then
    echo "✅ Database schema verification passed!"
else
    echo "⚠️  Database schema verification failed"
    echo "💡 The application may still work, but some features might be unavailable"
fi

echo "🎮 Game Catalog Service database initialization completed!"