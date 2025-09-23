# Database Setup Documentation

## Overview
This document describes the database and caching setup for the Social Service, implemented as part of Task 2.

## Database Configuration

### PostgreSQL Setup
The service uses PostgreSQL as the primary database with the following configuration:

- **Host**: localhost (configurable via `DB_HOST`)
- **Port**: 5432 (configurable via `DB_PORT`)
- **Database**: social_service (configurable via `DB_NAME`)
- **Username**: postgres (configurable via `DB_USERNAME`)
- **Password**: password (configurable via `DB_PASSWORD`)

### Connection Pool Settings
- **Max connections**: 20
- **Min connections**: 5
- **Acquire timeout**: 30 seconds
- **Idle timeout**: 10 seconds

## Entities

### 1. Friendship Entity
- **Table**: `friendships`
- **Purpose**: Manages friend relationships between users
- **Key Features**:
  - Unique constraint on (userId, friendId)
  - Self-friendship prevention check
  - Indexed on userId, friendId, status, and requestedBy
  - Status enum: PENDING, ACCEPTED, DECLINED, BLOCKED

### 2. Message Entity
- **Table**: `messages`
- **Purpose**: Stores direct messages between friends
- **Key Features**:
  - Self-messaging prevention check
  - Content length limit: 1000 characters
  - Indexed for conversation queries and unread messages
  - Read status tracking with timestamps

### 3. OnlineStatus Entity
- **Table**: `online_status`
- **Purpose**: Tracks user online status and current game
- **Key Features**:
  - Unique constraint on userId
  - Status enum: ONLINE, OFFLINE, AWAY
  - Current game tracking (optional)
  - Indexed on status and lastSeen for efficient queries

## Redis Caching

### Configuration
- **Host**: localhost (configurable via `REDIS_HOST`)
- **Port**: 6379 (configurable via `REDIS_PORT`)
- **Password**: Optional (configurable via `REDIS_PASSWORD`)
- **Key Prefix**: `social-service:`
- **Default TTL**: 300 seconds (5 minutes)
- **Max Items**: 1000

### Features
- Global cache module available across all services
- Health check endpoint for monitoring
- Automatic retry and failover handling

## Migrations

### Setup
Migrations are located in `src/migrations/` and managed via TypeORM CLI commands:

```bash
# Generate a new migration
npm run migration:generate -- src/migrations/MigrationName

# Create an empty migration
npm run migration:create -- src/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

### Initial Migration
The initial migration (`1703000000000-InitialMigration.ts`) creates:
- All three main tables with proper constraints
- All necessary indexes for performance
- Enum types for status fields
- Check constraints for data integrity

## Health Monitoring

### Endpoints
- `GET /health` - Overall health check
- `GET /health/database` - Database connectivity check
- `GET /health/redis` - Redis connectivity check

### Health Check Features
- Database connection testing via simple query
- Redis read/write operation testing
- Detailed error reporting
- Response time tracking

## Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=social_service

# Redis Cache
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Application
NODE_ENV=development
```

## Development vs Production

### Development
- `synchronize: true` - Automatic schema synchronization
- `logging: true` - SQL query logging enabled
- No SSL required

### Production
- `synchronize: false` - Manual migration control
- `logging: false` - Reduced logging for performance
- SSL enabled with `rejectUnauthorized: false`

## Performance Considerations

### Database Indexes
- Composite indexes on frequently queried columns
- Separate indexes for different query patterns
- Unique constraints for data integrity

### Connection Pooling
- Configured for optimal performance under load
- Automatic connection management
- Timeout handling for stuck connections

### Caching Strategy
- Redis for frequently accessed data
- Configurable TTL per cache entry
- Automatic cache invalidation support

## Testing

### Configuration Tests
- Database configuration validation
- Redis configuration validation
- Environment variable handling

### Health Check Tests
- Database connectivity testing
- Redis connectivity testing
- Error handling validation

## Troubleshooting

### Common Issues
1. **Database Connection Failed**: Check PostgreSQL service and credentials
2. **Redis Connection Failed**: Verify Redis service and network connectivity
3. **Migration Errors**: Ensure database exists and user has proper permissions

### Monitoring
Use the health endpoints to monitor service status:
- Database connectivity
- Redis connectivity
- Overall service health