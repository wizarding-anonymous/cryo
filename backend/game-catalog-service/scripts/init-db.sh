#!/bin/bash

# Database initialization script for Game Catalog Service
# This script sets up the PostgreSQL database with all required tables, indexes, and initial data

set -e

# Default values
DB_HOST=${POSTGRES_HOST:-localhost}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-game_catalog}
DB_USER=${POSTGRES_USER:-postgres}
DB_PASSWORD=${POSTGRES_PASSWORD:-password}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Initializing Game Catalog Service Database${NC}"
echo "=================================================="
echo "Host: $DB_HOST:$DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# Check if PostgreSQL is running
echo -e "${YELLOW}📡 Checking PostgreSQL connection...${NC}"
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
    echo -e "${RED}❌ PostgreSQL is not running or not accessible${NC}"
    echo "Please ensure PostgreSQL is running and accessible at $DB_HOST:$DB_PORT"
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL connection successful${NC}"

# Create database if it doesn't exist
echo -e "${YELLOW}🗄️  Creating database if not exists...${NC}"
PGPASSWORD="$DB_PASSWORD" createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null || true
echo -e "${GREEN}✅ Database ready${NC}"

# Run TypeORM migrations
echo -e "${YELLOW}🔄 Running TypeORM migrations...${NC}"
cd "$(dirname "$0")/.."
npm run migration:run
echo -e "${GREEN}✅ Migrations completed${NC}"

# Run initialization SQL script
echo -e "${YELLOW}📝 Running database initialization script...${NC}"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "scripts/init-database.sql"
echo -e "${GREEN}✅ Database initialization completed${NC}"

# Verify installation
echo -e "${YELLOW}🔍 Verifying database setup...${NC}"
TABLE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
CATEGORY_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM categories;")
TAG_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM tags;")

echo "Tables created: $(echo $TABLE_COUNT | xargs)"
echo "Categories inserted: $(echo $CATEGORY_COUNT | xargs)"
echo "Tags inserted: $(echo $TAG_COUNT | xargs)"

if [ "$(echo $TABLE_COUNT | xargs)" -gt "10" ]; then
    echo -e "${GREEN}✅ Database setup verification successful${NC}"
else
    echo -e "${RED}❌ Database setup verification failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Game Catalog Service database initialization completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Start the application: npm run start:dev"
echo "2. Check API documentation at: http://localhost:3000/api"
echo "3. Test database connection with your application"
echo ""
echo "Database connection string:"
echo "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"