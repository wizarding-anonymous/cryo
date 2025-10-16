# Optimized User Repositories

This document describes the optimized repository implementation for the User Service, designed to handle large datasets efficiently with cursor-based pagination and batch operations.

## Overview

The optimized repositories provide high-performance database operations for the User Service, including:

- **Cursor-based pagination** for efficient large dataset handling
- **Batch operations** for bulk create, update, and delete operations
- **Advanced filtering** with optimized database queries
- **Performance monitoring** and metrics collection
- **Intelligent caching** integration

## Components

### OptimizedUserRepository

The main repository class that provides optimized database operations.

#### Key Features

1. **Cursor-based Pagination**
   - More efficient than offset-based pagination for large tables
   - Consistent performance regardless of dataset size
   - Supports sorting by `createdAt`, `updatedAt`, or `lastLoginAt`

2. **Batch Operations**
   - Chunked processing to avoid memory issues
   - Configurable chunk sizes and error handling
   - Optimized SQL queries using CASE-WHEN statements

3. **Advanced Filtering**
   - Filter by active status, login history, creation dates
   - Email domain filtering
   - JSONB field queries for preferences and privacy settings

4. **Performance Optimizations**
   - Database indexes for common query patterns
   - Connection pooling optimization
   - Query result caching with Redis

### OptimizedUserService

Service layer that orchestrates repository operations with caching and performance monitoring.

#### Key Features

1. **Intelligent Caching**
   - Cache-aside pattern implementation
   - Batch cache operations
   - Automatic cache invalidation

2. **Performance Monitoring**
   - Query execution time tracking
   - Cache hit rate monitoring
   - Slow query detection

3. **Error Handling**
   - Graceful degradation when cache is unavailable
   - Comprehensive error logging
   - Retry mechanisms for transient failures

### OptimizedUserController

REST API endpoints for optimized user operations.

#### Available Endpoints

- `GET /optimized/users` - Cursor-based user listing
- `GET /optimized/users/search` - Advanced user search
- `POST /optimized/users/batch/lookup` - Batch user retrieval
- `POST /optimized/users/batch/create` - Batch user creation
- `PATCH /optimized/users/batch/update` - Batch user updates
- `DELETE /optimized/users/batch/soft-delete` - Batch soft deletion
- `GET /optimized/users/recently-active` - Recently active users
- `GET /optimized/users/by-domain/:domain` - Users by email domain
- `GET /optimized/users/statistics` - User statistics and metrics

## Database Optimizations

### Indexes

The following indexes are created for optimal query performance:

```sql
-- Composite index for active users with last login
CREATE INDEX "idx_users_active_last_login" 
ON "users" ("is_active", "last_login_at" DESC) 
WHERE "deleted_at" IS NULL AND "is_active" = true;

-- Composite index for created_at with active status
CREATE INDEX "idx_users_created_active" 
ON "users" ("created_at" DESC, "is_active") 
WHERE "deleted_at" IS NULL;

-- Index for email domain queries
CREATE INDEX "idx_users_email_domain" 
ON "users" (SPLIT_PART("email", '@', 2)) 
WHERE "deleted_at" IS NULL;

-- GIN indexes for JSONB fields
CREATE INDEX "idx_users_preferences_gin" 
ON "users" USING GIN ("preferences") 
WHERE "preferences" IS NOT NULL AND "deleted_at" IS NULL;

-- Trigram index for name searches
CREATE INDEX "idx_users_name_trgm" 
ON "users" USING GIN ("name" gin_trgm_ops) 
WHERE "deleted_at" IS NULL;
```

### Connection Pool Configuration

Optimized connection pool settings based on environment:

- **Development**: 10 max connections, 2 min connections
- **Test**: 5 max connections, 1 min connection
- **Production**: Configurable max connections, 20% min connections

## Usage Examples

### Cursor-based Pagination

```typescript
// Get first page of users
const firstPage = await optimizedUserService.getUsersWithPagination({
  limit: 100,
  sortBy: 'createdAt',
  sortOrder: 'DESC'
});

// Get next page using cursor
const nextPage = await optimizedUserService.getUsersWithPagination({
  cursor: firstPage.nextCursor,
  limit: 100,
  sortBy: 'createdAt',
  sortOrder: 'DESC'
});
```

### Batch Operations

```typescript
// Batch user lookup
const userIds = ['id1', 'id2', 'id3', ...];
const usersMap = await optimizedUserService.getUsersByIdsBatch(userIds);

// Batch user creation
const userData = [
  { name: 'User 1', email: 'user1@example.com', password: 'hashed_password' },
  { name: 'User 2', email: 'user2@example.com', password: 'hashed_password' },
];
const createdUsers = await optimizedUserService.createUsersBatch(userData);

// Batch user updates
const updates = [
  { id: 'user1_id', data: { name: 'Updated Name 1' } },
  { id: 'user2_id', data: { name: 'Updated Name 2' } },
];
await optimizedUserService.updateUsersBatch(updates);
```

### Advanced Filtering

```typescript
// Search recently active users from specific domain
const recentlyActive = await optimizedUserService.searchUsersWithFilters(
  {
    isActive: true,
    hasLastLogin: true,
    emailDomain: 'company.com',
    createdAfter: new Date('2024-01-01'),
  },
  {
    limit: 50,
    sortBy: 'lastLoginAt',
    sortOrder: 'DESC'
  }
);
```

## Performance Monitoring

### Metrics Collection

The service automatically collects performance metrics:

- **Query Execution Time**: Average execution time for database queries
- **Cache Hit Rate**: Percentage of requests served from cache
- **Total Queries**: Total number of queries executed
- **Slow Queries**: Number of queries exceeding threshold

### Getting Metrics

```typescript
// Get current performance metrics
const metrics = optimizedUserService.getPerformanceMetrics();

// Get comprehensive statistics
const stats = await optimizedUserService.getUserStatistics();
```

## Configuration

### Environment Variables

```env
# Database connection pool
POSTGRES_MAX_CONNECTIONS=20
POSTGRES_CONNECTION_TIMEOUT=10000

# Query cache settings
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Performance thresholds
SLOW_QUERY_THRESHOLD=1000
BATCH_CHUNK_SIZE=500
```

### TypeORM Configuration

The optimized configuration includes:

- Connection pooling with environment-specific settings
- Query result caching using Redis
- Slow query logging
- Connection validation and eviction

## Best Practices

### When to Use Optimized Operations

1. **Large Datasets**: Use cursor-based pagination for tables with >10,000 records
2. **Batch Operations**: Use batch methods when processing >100 records
3. **Frequent Queries**: Use caching for frequently accessed user data
4. **Analytics**: Use statistics endpoints for monitoring and reporting

### Performance Considerations

1. **Pagination**: Always use cursor-based pagination for large datasets
2. **Batch Size**: Keep batch sizes under 1,000 records to avoid memory issues
3. **Caching**: Implement cache warming for frequently accessed users
4. **Monitoring**: Regularly check performance metrics and optimize accordingly

### Error Handling

1. **Graceful Degradation**: Service continues to work even if cache is unavailable
2. **Retry Logic**: Implement retries for transient database errors
3. **Logging**: Comprehensive error logging with correlation IDs
4. **Monitoring**: Set up alerts for performance degradation

## Migration Guide

### From Standard Repository

1. **Replace Offset Pagination**: Convert `skip`/`take` to cursor-based pagination
2. **Batch Operations**: Replace loops with batch methods
3. **Add Caching**: Implement cache-aside pattern for frequently accessed data
4. **Monitor Performance**: Set up metrics collection and monitoring

### Database Migration

Run the optimization migration to add required indexes:

```bash
npm run migration:run
```

This will execute the `AddOptimizedIndexesToUsers` migration that creates all necessary indexes for optimal performance.

## Troubleshooting

### Common Issues

1. **Slow Queries**: Check if appropriate indexes are created
2. **Memory Issues**: Reduce batch sizes or enable chunking
3. **Cache Misses**: Implement cache warming for frequently accessed data
4. **Connection Pool Exhaustion**: Adjust pool settings based on load

### Monitoring Queries

Use the built-in query logging to identify performance bottlenecks:

```typescript
// Enable query logging in development
logging: ['query', 'error', 'warn', 'migration']

// Check slow query logs
maxQueryExecutionTime: 1000 // Log queries > 1 second
```

## Future Enhancements

1. **Read Replicas**: Support for read replica routing
2. **Sharding**: Horizontal partitioning for very large datasets
3. **Advanced Caching**: Multi-level caching with TTL optimization
4. **Query Optimization**: Automatic query plan analysis and optimization