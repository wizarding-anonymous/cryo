# Game Catalog Service - Database Setup

This document describes the database schema, setup process, and management for the Game Catalog Service.

## Overview

The Game Catalog Service uses PostgreSQL as the primary database with the following additional components:
- **PostgreSQL 15+**: Main relational database with full-text search capabilities
- **Redis**: Caching layer for improved performance
- **Elasticsearch**: Advanced search and analytics
- **TypeORM**: Database ORM and migration management

## Database Schema

### Core Entities

#### Games
The central entity storing game information:
- Basic metadata (title, description, price, release date)
- System requirements (embedded object)
- Status tracking (draft, pending_review, published, rejected, archived)
- Full-text search vector for Russian language support
- Developer and publisher references

#### Categories
Hierarchical category system:
- Self-referencing parent-child relationships
- Slug-based URLs
- Automatic game count tracking

#### Tags
Flat tag system for flexible game labeling:
- Unique names and slugs
- Automatic game count tracking
- Support for localization tags

#### Extended Features
- **Preorders**: Multi-tier preorder system with bonuses
- **Demos**: Time-limited, content-limited, and cloud demos
- **DLC**: Downloadable content management
- **Editions**: Different game editions (Standard, Deluxe, etc.)
- **Bundles**: Game bundles with dynamic pricing
- **Franchises**: Game series management
- **Media**: Screenshots and videos with metadata

### Relationships

```
Games (1) ←→ (M) Categories (Many-to-Many via game_categories)
Games (1) ←→ (M) Tags (Many-to-Many via game_tags)
Games (1) → (1) Preorder (One-to-One, optional)
Games (1) → (1) Demo (One-to-One, optional)
Games (1) → (M) DLC (One-to-Many)
Games (1) → (M) Screenshots (One-to-Many)
Games (1) → (M) Videos (One-to-Many)
Games (1) → (M) Discounts (One-to-Many)
Games (1) → (M) Translations (One-to-Many)
Games (1) → (M) Editions (One-to-Many)
Bundles (M) ←→ (M) Games (Many-to-Many via bundle_games)
Franchises (M) ←→ (M) Games (Many-to-Many via franchise_games)
```

## Setup Instructions

### Prerequisites

1. **PostgreSQL 15+** installed and running
2. **Node.js 18+** and npm
3. **Redis** (optional, for caching)
4. **Elasticsearch** (optional, for advanced search)

### Environment Variables

Create a `.env` file in the project root:

```env
# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=game_catalog
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# Redis Configuration (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Elasticsearch Configuration (optional)
ELASTICSEARCH_HOST=localhost
ELASTICSEARCH_PORT=9200
```

### Quick Setup with Docker

1. **Start all services**:
   ```bash
   docker-compose -f docker-compose.db.yml up -d
   ```

2. **Wait for services to be healthy**:
   ```bash
   docker-compose -f docker-compose.db.yml ps
   ```

3. **Run migrations and initialization**:
   ```bash
   npm run migration:run
   ```

### Manual Setup

#### 1. Database Creation

```bash
# Create database
createdb -U postgres game_catalog

# Or using psql
psql -U postgres -c "CREATE DATABASE game_catalog;"
```

#### 2. Run Setup Script

**Linux/macOS**:
```bash
chmod +x scripts/init-db.sh
./scripts/init-db.sh
```

**Windows**:
```cmd
scripts\init-db.bat
```

#### 3. Verify Setup

```bash
# Check tables
psql -U postgres -d game_catalog -c "\dt"

# Check sample data
psql -U postgres -d game_catalog -c "SELECT COUNT(*) FROM categories;"
psql -U postgres -d game_catalog -c "SELECT COUNT(*) FROM tags;"
```

## Migration Management

### Creating New Migrations

```bash
# Generate migration from entity changes
npm run migration:generate -- src/infrastructure/persistence/migrations/NewFeature

# Create empty migration
npm run typeorm -- migration:create src/infrastructure/persistence/migrations/NewFeature
```

### Running Migrations

```bash
# Run all pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Show migration status
npm run typeorm -- migration:show
```

## Performance Optimization

### Indexes

The database includes comprehensive indexes for:
- **Primary searches**: title, slug, status
- **Filtering**: price, release date, developer, publisher
- **Relationships**: foreign keys, junction tables
- **Full-text search**: Russian language support with unaccent
- **Composite indexes**: common query patterns

### Full-Text Search

Russian language full-text search is configured with:
- Custom `russian_unaccent` configuration
- Automatic search vector updates via triggers
- Weighted search (title > description > short description)
- GIN index for fast text queries

### Query Functions

Pre-built functions for common operations:
- `search_games(query, limit)`: Full-text search with ranking
- `get_games_by_category_tree(slug)`: Hierarchical category search
- Automatic count updates for categories and tags

## Sample Data

The initialization script includes:
- **10 main categories** with subcategories
- **20 common tags** including localization tags
- **3 sample franchises** (Metro, S.T.A.L.K.E.R., Pathologic)
- **2 sample bundles**

## Monitoring and Maintenance

### Health Checks

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('game_catalog'));

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY n_distinct DESC;
```

### Backup and Restore

```bash
# Backup
pg_dump -U postgres -h localhost game_catalog > backup.sql

# Restore
psql -U postgres -h localhost game_catalog < backup.sql
```

### Performance Tuning

Key PostgreSQL settings for optimal performance:

```sql
-- Increase shared buffers (25% of RAM)
ALTER SYSTEM SET shared_buffers = '256MB';

-- Increase work memory for sorting
ALTER SYSTEM SET work_mem = '4MB';

-- Increase maintenance work memory
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Enable query planning improvements
ALTER SYSTEM SET random_page_cost = 1.1;

-- Reload configuration
SELECT pg_reload_conf();
```

## Troubleshooting

### Common Issues

1. **Migration fails**: Check PostgreSQL version and permissions
2. **Search not working**: Verify `unaccent` extension is installed
3. **Slow queries**: Check if indexes are being used with `EXPLAIN ANALYZE`
4. **Connection issues**: Verify environment variables and network connectivity

### Debug Queries

```sql
-- Check active connections
SELECT * FROM pg_stat_activity WHERE datname = 'game_catalog';

-- Check locks
SELECT * FROM pg_locks WHERE database = (SELECT oid FROM pg_database WHERE datname = 'game_catalog');

-- Check query performance
SELECT query, mean_exec_time, calls FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
```

## API Integration

The database is designed to support the REST API with:
- Efficient pagination queries
- Complex filtering and sorting
- Full-text search capabilities
- Optimized relationship loading
- Caching-friendly structure

For API documentation, see the main README.md file.