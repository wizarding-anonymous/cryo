# TypeORM Query Cache Integration

## Overview

This document describes the integration of TypeORM query caching with Redis for the User Service. The implementation provides intelligent caching for database queries, slow query monitoring, and performance optimization.

## Features

### 1. Automatic Query Caching
- **Redis Integration**: Uses shared Redis instance from docker-compose.yml
- **Intelligent Caching**: Only caches SELECT queries, skips write operations
- **TTL Management**: Configurable TTL based on query type and environment
- **Cache Invalidation**: Tag-based invalidation for related data

### 2. Slow Query Monitoring
- **Threshold-based Logging**: Logs queries exceeding configured threshold (default: 1 second)
- **Statistics Collection**: Tracks query performance metrics
- **Critical Query Alerts**: Special handling for queries > 5 seconds
- **Repository-specific Monitoring**: Tracks performance per repository

### 3. Performance Optimization
- **Connection Pooling**: Optimized database connection pool settings
- **Query Optimization**: Automatic detection of inefficient queries
- **Memory Management**: Limits cache size to prevent memory issues
- **Batch Operations**: Optimized handling of bulk operations

## Configuration

### Environment Variables

```bash
# Query Cache Configuration
QUERY_CACHE_ENABLED=true
QUERY_CACHE_TTL=300          # 5 minutes default
QUERY_CACHE_MAX_SIZE=10000   # Maximum cached entries
SLOW_QUERY_THRESHOLD=1000    # 1 second threshold

# Redis Configuration (shared)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### TypeORM Configuration

The cache is automatically configured in `ConfigFactory.createTypeOrmConfig()`:

```typescript
cache: {
  type: 'redis',
  options: {
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    db: redisConfig.db + 1, // Separate DB for query cache
    keyPrefix: 'user-service:typeorm-query-cache:',
  },
  duration: configuredTTL * 1000, // Convert to milliseconds
  ignoreErrors: true, // Don't fail if Redis unavailable
}
```

## Usage

### 1. Repository Integration

Repositories can extend `CachedRepositoryBase` for automatic caching:

```typescript
@Injectable()
export class OptimizedUserRepository extends CachedRepositoryBase<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    dataSource: DataSource,
    cacheService: TypeOrmQueryCacheService,
    slowQueryMonitor: SlowQueryMonitorService,
  ) {
    super(User, dataSource, cacheService, slowQueryMonitor);
  }

  // Cached query execution
  async findUsersWithCache(): Promise<User[]> {
    return this.executeCachedQuery<User[]>(
      'SELECT * FROM users WHERE is_active = $1',
      [true],
      {
        ttl: 300,
        tags: ['users', 'active'],
      }
    );
  }
}
```

### 2. Cache Decorators

Use decorators for method-level caching:

```typescript
@CacheQuery(CacheConfigs.USER)
async findActiveUsers(): Promise<User[]> {
  return this.find({ where: { isActive: true } });
}

@InvalidateCache(['users', 'statistics'])
async createUser(userData: CreateUserDto): Promise<User> {
  return this.save(userData);
}

@TimeSensitiveCache(['statistics'])
async getUserCount(): Promise<number> {
  return this.count();
}
```

### 3. Manual Cache Management

```typescript
// Get cached result
const cachedUsers = await this.cacheService.get(query, parameters);

// Set cache with options
await this.cacheService.set(query, parameters, result, {
  ttl: 600,
  tags: ['users', 'profiles'],
});

// Invalidate by tags
await this.cacheService.invalidateByTags(['users']);

// Clear all cache
await this.cacheService.clear();
```

## Monitoring

### 1. Cache Statistics

Access cache statistics via the query cache service:

```typescript
const stats = await this.cacheService.getStats();
console.log({
  hits: stats.hits,
  misses: stats.misses,
  hitRate: `${stats.hitRate.toFixed(2)}%`,
  cacheSize: stats.cacheSize,
  memoryUsage: `${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`,
});
```

### 2. Slow Query Monitoring

Monitor slow queries via the dedicated service:

```typescript
// Get slow query statistics
const slowStats = await this.slowQueryMonitor.getSlowQueryStats();

// Get recent slow queries
const recentSlow = await this.slowQueryMonitor.getRecentSlowQueries(10);

// Get slow queries by repository
const repoSlow = await this.slowQueryMonitor.getSlowQueriesByRepository('OptimizedUserRepository');
```

### 3. API Endpoints

Internal monitoring endpoints are available:

- `GET /internal/database/slow-queries/stats` - Slow query statistics
- `GET /internal/database/slow-queries/recent` - Recent slow queries
- `GET /internal/database/slow-queries/by-repository` - Queries by repository
- `DELETE /internal/database/slow-queries/logs` - Clear slow query logs

- `GET /internal/cache/query-cache/stats` - Query cache statistics
- `POST /internal/cache/query-cache/invalidate` - Invalidate cache by tags
- `DELETE /internal/cache/query-cache/clear` - Clear all cache

## Performance Tuning

### 1. Cache TTL Guidelines

- **User lookups**: 5 minutes (300s)
- **Statistics**: 1-2 minutes (60-120s)
- **Profile data**: 10 minutes (600s)
- **Search results**: 3 minutes (180s)

### 2. Query Optimization

The system automatically:
- Detects and logs slow queries (> 1 second)
- Provides query normalization for statistics
- Tracks query frequency and performance
- Suggests optimization opportunities

### 3. Memory Management

- Cache size is limited to prevent memory issues
- LRU eviction policy for Redis
- Automatic cleanup of expired entries
- Memory usage monitoring and alerts

## Best Practices

### 1. Cache Key Design
- Use consistent key patterns
- Include relevant parameters in keys
- Use appropriate namespacing
- Consider key length for performance

### 2. Cache Invalidation
- Use tag-based invalidation for related data
- Invalidate on write operations
- Consider cascade invalidation for dependent data
- Monitor invalidation patterns

### 3. Query Design
- Write cache-friendly queries
- Avoid non-deterministic functions (NOW(), RANDOM())
- Use parameterized queries
- Consider query complexity vs. cache benefit

### 4. Monitoring
- Set up alerts for slow queries
- Monitor cache hit rates
- Track memory usage
- Review query patterns regularly

## Troubleshooting

### 1. Cache Issues

**Problem**: Low cache hit rate
**Solution**: 
- Review query patterns
- Check TTL settings
- Verify cache key generation
- Monitor invalidation frequency

**Problem**: High memory usage
**Solution**:
- Reduce cache size limits
- Lower TTL values
- Review cached data size
- Implement more aggressive eviction

### 2. Performance Issues

**Problem**: Slow queries not being cached
**Solution**:
- Verify query is SELECT statement
- Check for non-deterministic functions
- Review cache conditions
- Ensure proper repository integration

**Problem**: Cache invalidation too frequent
**Solution**:
- Review invalidation tags
- Optimize write operation patterns
- Consider more granular invalidation
- Monitor write vs. read ratios

### 3. Redis Connection Issues

**Problem**: Cache service unavailable
**Solution**:
- Check Redis connection settings
- Verify network connectivity
- Review Redis server status
- Enable graceful degradation

## Integration with Shared Infrastructure

### 1. Docker Compose Integration

The cache uses the shared Redis instance from `backend/docker-compose.yml`:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
```

### 2. Database Configuration

Uses shared PostgreSQL with optimized connection pooling:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: user_service_db
      POSTGRES_USER: user_service
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

### 3. Monitoring Integration

Integrates with existing monitoring stack:
- Prometheus metrics for cache performance
- Grafana dashboards for visualization
- ELK stack for log aggregation
- Health checks for Kubernetes

## Future Enhancements

1. **Distributed Caching**: Multi-region cache replication
2. **Advanced Analytics**: ML-based query optimization
3. **Auto-tuning**: Automatic TTL and size optimization
4. **Cache Warming**: Predictive cache population
5. **Query Hints**: Developer-friendly optimization suggestions