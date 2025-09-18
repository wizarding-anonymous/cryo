# Database Setup - Achievement Service

## Overview

This document describes the database setup for the Achievement Service, including PostgreSQL and Redis configuration.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+
- PostgreSQL 14+ (if running locally)
- Redis 7+ (if running locally)

## Quick Start with Docker

1. Start the development databases:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

2. Copy environment configuration:
```bash
cp .env.example .env
```

3. Run migrations:
```bash
npm run migration:run
```

4. Start the application:
```bash
npm run start:dev
```

## Database Schema

### Tables

#### achievements
- Stores achievement definitions
- Includes conditions, points, and metadata
- Indexed on `name` and `type` for performance

#### user_achievements
- Tracks unlocked achievements per user
- Unique constraint on `userId` + `achievementId`
- Indexed for fast user queries

#### user_progress
- Tracks progress towards achievements
- Stores current and target values
- Unique constraint on `userId` + `achievementId`

### Indexes

Optimized indexes for common query patterns:
- User-specific queries (`userId`)
- Achievement lookups (`achievementId`)
- Composite unique constraints

## Environment Variables

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=achievement_service

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Cache Configuration
CACHE_TTL=300
CACHE_MAX_ITEMS=100
```

## Migration Commands

```bash
# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Show migration status
npm run migration:show

# Generate new migration
npm run migration:generate -- src/migrations/MigrationName
```

## Development

The database module is configured to:
- Auto-run migrations in development
- Enable query logging in development
- Use synchronize=false for production safety
- Support both PostgreSQL and Redis connections

## Production Notes

- Set `NODE_ENV=production` to disable synchronize
- Use proper database credentials
- Configure Redis with authentication
- Set appropriate cache TTL values
- Monitor database performance and indexes