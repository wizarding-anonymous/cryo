# CacheService - Multi-level Caching for User Service

## Overview

CacheService provides a comprehensive caching solution for the User Service, implementing multi-level caching with Redis backend, batch operations, and comprehensive metrics collection.

## Features

- **Multi-level Caching**: Separate caching for users and profiles with different TTL values
- **Batch Operations**: Efficient batch get/set operations using Redis pipelines
- **Metrics Collection**: Prometheus metrics for cache hit/miss ratios, latency, and operation counts
- **Health Monitoring**: Built-in health checks and cache statistics
- **Graceful Degradation**: Service continues to work even if Redis is unavailable
- **Namespace Isolation**: All cache keys are namespaced to avoid conflicts

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   UserService   │───▶│   CacheService  │───▶│   RedisService  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ CacheMetrics    │
                       │ (Prometheus)    │
                       └─────────────────┘
```

## Usage

### Basic User Caching

```typescript
// Get user from cache
const user = await cacheService.getUser(userId);

// Set user in cache with default TTL (5 minutes)
await cacheService.setUser(user);

// Set user with custom TTL
await cacheService.setUser(user, 600); // 10 minutes

// Invalidate user cache
await cacheService.invalidateUser(userId);
```

### Profile Caching

```typescript
// Get profile from cache
const profile = await cacheService.getProfile(userId);

// Set profile in cache
await cacheService.setProfile(profile);

// Invalidate profile cache
await cacheService.invalidateProfile(userId);
```

### Batch Operations

```typescript
// Batch get users
const userIds = ['user1', 'user2', 'user3'];
const usersMap = await cacheService.getUsersBatch(userIds);

// Batch set users
const users = [user1, user2, user3];
await cacheService.setUsersBatch(users);

// Advanced batch get with detailed results
const result = await cacheService.getUsersBatchAdvanced(userIds);
console.log(`Hit ratio: ${result.hitRatio}%`);
console.log(`Missing users: ${result.missing.length}`);
```

### Cache Management

```typescript
// Get cache statistics
const stats = await cacheService.getCacheStats();
console.log(`Hit ratio: ${stats.hitRatio}%`);
console.log(`Average latency: ${stats.averageLatency}ms`);

// Get cache info
const info = await cacheService.getCacheInfo();
console.log(`Total keys: ${info.keyCount}`);
console.log(`Memory usage: ${info.memoryUsage}`);

// Clear all cache
await cacheService.clearCache();

// Warm up cache
await cacheService.warmUpCache(users);
```

## Configuration

### Default TTL Values

- **User Cache**: 300 seconds (5 minutes)
- **Profile Cache**: 600 seconds (10 minutes)
- **Batch Cache**: 180 seconds (3 minutes)

### Cache Keys Structure

All cache keys follow the pattern: `user-service:{type}:{identifier}`

Examples:
- User: `user-service:user:123e4567-e89b-12d3-a456-426614174000`
- Profile: `user-service:profile:123e4567-e89b-12d3-a456-426614174000`

## Metrics

CacheService automatically collects Prometheus metrics:

### Counters
- `user_cache_hits_total{cache_type, operation}` - Total cache hits
- `user_cache_misses_total{cache_type, operation}` - Total cache misses
- `user_cache_operations_total{cache_type, operation, status}` - Total operations
- `user_batch_operations_total{operation, status}` - Total batch operations

### Histograms
- `user_cache_operation_duration_seconds{cache_type, operation}` - Operation latency
- `user_batch_operation_duration_seconds{operation}` - Batch operation latency
- `user_batch_size{operation}` - Batch operation sizes

### Gauges
- `user_cache_size_keys{cache_type}` - Number of keys in cache
- `user_cache_hit_ratio{cache_type}` - Cache hit ratio (0-1)

## Integration with UserService

CacheService is automatically integrated into UserService methods:

```typescript
// UserService methods that use caching:
- findById() - Uses cache-aside pattern
- findByEmail() - Caches result after DB lookup
- create() - Caches new user
- update() - Invalidates and updates cache
- delete() - Invalidates cache
- updateLastLogin() - Invalidates cache

// New batch methods:
- findUsersBatch() - Batch retrieval with caching
- createUsersBatch() - Batch creation with caching
- updateLastLoginBatch() - Batch update with cache invalidation
```

## Health Checks

CacheService provides health check endpoints:

```typescript
// Basic health check
const isHealthy = await cacheService.healthCheck();

// Detailed health information (available in /health/detailed)
{
  "cache": {
    "stats": {
      "hitRatio": 85.5,
      "totalOperations": 1000,
      "averageLatency": 2.3
    },
    "info": {
      "keyCount": 150,
      "memoryUsage": "2.5MB",
      "namespace": "user-service"
    }
  }
}
```

## Error Handling

CacheService implements graceful error handling:

- **Redis Unavailable**: Operations return null/empty results, service continues
- **Network Timeouts**: Operations fail gracefully with logging
- **Memory Pressure**: Redis handles eviction automatically
- **Invalid Data**: JSON parsing errors are caught and logged

## Performance Considerations

### Batch Operations
- Use batch operations for multiple user lookups (>5 users)
- Batch operations use Redis pipelines for efficiency
- Maximum recommended batch size: 100 items

### TTL Strategy
- Users: Short TTL (5 min) for frequently changing data
- Profiles: Longer TTL (10 min) for relatively static data
- Adjust TTL based on update frequency

### Memory Usage
- Monitor cache size with `getCacheInfo()`
- Use pattern-based invalidation for bulk cleanup
- Consider implementing LRU eviction policies

## Testing

Run cache service tests:

```bash
npm test -- cache.service.spec.ts
```

Test coverage includes:
- Basic cache operations (get/set/delete)
- Batch operations
- Error handling
- Metrics collection
- Health checks

## Troubleshooting

### Common Issues

1. **High Cache Miss Ratio**
   - Check TTL values
   - Monitor cache invalidation patterns
   - Verify Redis memory limits

2. **Slow Cache Operations**
   - Check Redis connection latency
   - Monitor batch operation sizes
   - Review network configuration

3. **Memory Usage Growth**
   - Implement cache cleanup policies
   - Monitor key expiration
   - Check for memory leaks

### Debugging

Enable debug logging:
```typescript
// Set LOG_LEVEL=debug in environment
// Cache operations will log detailed information
```

Monitor metrics in Grafana:
- Cache hit/miss ratios
- Operation latencies
- Batch operation performance
- Memory usage trends

## Future Enhancements

- [ ] Implement cache warming strategies
- [ ] Add cache compression for large objects
- [ ] Implement distributed cache invalidation
- [ ] Add cache analytics and recommendations
- [ ] Support for cache partitioning
- [ ] Implement cache backup/restore functionality