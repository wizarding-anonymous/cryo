# Auth Service Database Setup

This document describes the database setup and management for the Auth Service.

## Overview

The Auth Service uses a dedicated PostgreSQL database for storing authentication-related data including:
- User sessions
- Token blacklists
- Login attempts
- Security events

## Quick Start

### 1. Start Database Services

```bash
# Start all backend services including Auth Service database
cd backend
docker-compose up -d postgres-auth redis

# Or start all services
docker-compose up -d

# Check service status
docker-compose ps
```

### 2. Initialize Database

```bash
# Initialize database and run migrations
npm run db:init

# Check database status
npm run db:status
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and configure database settings:

```bash
cp .env.example .env
```

Key database environment variables:
```env
# Local development
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=auth_db
DATABASE_USERNAME=auth_service
DATABASE_PASSWORD=auth_password

# Docker environment (handled by .env.docker)
DATABASE_HOST=postgres-auth
DATABASE_PORT=5432
DATABASE_MAX_CONNECTIONS=20
DATABASE_MIN_CONNECTIONS=5
```

## Database Management Commands

### CLI Commands

```bash
# Initialize database (create tables, run migrations)
npm run db:init

# Show database status and health
npm run db:status

# Reset database (development only)
npm run db:reset

# Test database performance
npm run db:test
```

### Migration Commands

```bash
# Generate new migration
npm run migration:generate -- src/database/migrations/MigrationName

# Create empty migration
npm run migration:create -- src/database/migrations/MigrationName

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Synchronize schema (development only)
npm run schema:sync

# Drop all tables (development only)
npm run schema:drop
```

## Database Configuration

### Connection Pooling

The Auth Service is configured with connection pooling for optimal performance:

- **Max Connections**: 20 (configurable via `DATABASE_MAX_CONNECTIONS`)
- **Min Connections**: 5 (configurable via `DATABASE_MIN_CONNECTIONS`)
- **Acquire Timeout**: 30 seconds
- **Idle Timeout**: 30 seconds
- **Connection Timeout**: 10 seconds

### Performance Settings

PostgreSQL is configured with optimized settings for the Auth Service workload:

- **Shared Buffers**: 256MB
- **Effective Cache Size**: 1GB
- **Maintenance Work Memory**: 64MB
- **WAL Buffers**: 16MB
- **Max Connections**: 100

## Health Checks

### Application Health Endpoints

```bash
# Overall service health (includes database)
curl http://localhost:3001/api/health

# Detailed database health
curl http://localhost:3001/api/health/database

# Readiness probe
curl http://localhost:3001/api/health/ready

# Liveness probe
curl http://localhost:3001/api/health/live
```

### Database Health Check

```bash
# Check PostgreSQL connection
docker exec cryo-postgres-auth-db pg_isready -U auth_service -d auth_db

# Check Redis connection
docker exec cryo-redis-cache redis-cli -a redis_password ping
```

## Development Setup

### Local Development

1. **Start services from backend directory**:
   ```bash
   cd backend
   docker-compose up -d postgres-auth redis
   ```

2. **Initialize database**:
   ```bash
   cd auth-service
   npm run db:init
   ```

3. **Start Auth Service**:
   ```bash
   npm run start:dev
   ```

### Docker Development

1. **Start all services**:
   ```bash
   cd backend
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
   ```

2. **Check Auth Service logs**:
   ```bash
   docker-compose logs -f auth-service
   ```

### Testing

```bash
# Run unit tests
npm test

# Run e2e tests (requires database)
npm run test:e2e

# Run tests with coverage
npm run test:cov
```

## Production Deployment

### Environment Variables

Production environment requires these additional settings:

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:port/database
DATABASE_SSL=true
RUN_MIGRATIONS=true
```

### Docker Deployment

The Auth Service database is integrated into the main backend docker-compose.yml:

```yaml
# Auth Service Database
postgres-auth:
  image: postgres:15-alpine
  environment:
    POSTGRES_USER: auth_service
    POSTGRES_PASSWORD: ${AUTH_DB_PASSWORD}
    POSTGRES_DB: auth_db
  volumes:
    - postgres_auth_data:/var/lib/postgresql/data
  networks:
    - microservices-network
```

### Migration Strategy

1. **Backup existing data** (if applicable)
2. **Deploy new Auth Service** alongside existing services
3. **Run migrations** using `RUN_MIGRATIONS=true`
4. **Verify health checks** pass
5. **Update API Gateway** routing

## Monitoring

### Database Metrics

The Auth Service exposes database metrics via health endpoints:

- Connection pool statistics
- Query performance
- Migration status
- Database size and version

### Logging

Database operations are logged with structured logging:

```json
{
  "level": "info",
  "message": "Database connection established",
  "context": "DatabaseService",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "details": {
    "database": "auth_db",
    "host": "localhost",
    "port": 5433,
    "poolStats": {
      "totalConnections": 5,
      "idleConnections": 4,
      "waitingClients": 0
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Connection refused**:
   ```bash
   # Check if PostgreSQL is running
   docker-compose -f docker-compose.db.yml ps
   
   # Check logs
   docker-compose -f docker-compose.db.yml logs postgres-auth
   ```

2. **Migration failures**:
   ```bash
   # Check migration status
   npm run db:status
   
   # Revert last migration if needed
   npm run migration:revert
   ```

3. **Performance issues**:
   ```bash
   # Test database performance
   npm run db:test
   
   # Check connection pool stats
   curl http://localhost:3001/api/health/database
   ```

### Database Recovery

If database corruption occurs:

1. **Stop Auth Service**
2. **Backup current data** (if possible)
3. **Reset database**: `npm run db:reset`
4. **Restore from backup** (if available)
5. **Run migrations**: `npm run db:init`

## Security Considerations

### Database Security

- **Dedicated database user** with minimal required permissions
- **SSL connections** in production
- **Password authentication** with strong passwords
- **Network isolation** using Docker networks

### Data Protection

- **Sensitive data encryption** at application level
- **Password hashing** using bcrypt
- **Token blacklisting** for security
- **Audit logging** for all authentication events

## Backup and Recovery

### Automated Backups

```bash
# Create database backup (from backend directory)
docker exec cryo-postgres-auth-db pg_dump -U auth_service auth_db > auth_db_backup.sql

# Restore from backup (from backend directory)
docker exec -i cryo-postgres-auth-db psql -U auth_service auth_db < auth_db_backup.sql
```

### Backup Strategy

- **Daily automated backups** in production
- **Point-in-time recovery** capability
- **Cross-region backup replication**
- **Regular backup testing**