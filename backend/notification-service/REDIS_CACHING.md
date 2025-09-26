# Redis Caching Implementation

## Overview

The Notification Service implements a robust caching strategy using both in-memory caching (via NestJS Cache Manager) and Redis for persistent caching. This dual-layer approach provides optimal performance for MVP while being ready for production scaling.

## Architecture

### Dual-Layer Caching Strategy

1. **Memory Cache (L1)** - Fast access for frequently used data
2. **Redis Cache (L2)** - Persistent cache that survives service restarts

```
Request → Memory Cache → Redis Cache → Database
```

### Cache Flow

1. **Cache Hit (Memory)**: Return data immediately from memory
2. **Cache Miss (Memory) + Cache Hit (Redis)**: Load from Redis, store in memory, return data
3. **Cache Miss (Both)**: Load from database, store in both caches, return data

## Implementation Details

### Services

#### RedisCacheService
- **Location**: `src/cache/redis-cache.service.ts`
- **Purpose**: Direct Redis operations with connection management
- **Features**:
  - Automatic connection/disconnection
  - Error handling and graceful degradation
  - JSON serialization/deserialization
  - TTL support
  - Connection status monitoring

#### NotificationService (Enhanced)
- **Caching Methods**:
  - `getSettings()`: Dual-layer cache lookup
  - `updateSettings()`: Updates both cache layers
  - `clearSettingsCache()`: Clears both cache layers
  - `getCacheStats()`: Monitoring and diagnostics

### Configuration

#### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379
USE_REDIS_CACHE=true
```

#### Docker Compose

Redis is configured in both development and production Docker Compose files:

```yaml
redis:
  image: redis:7-alpine
  container_name: notification-redis
  ports:
    - "6380:6379"
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes
```

## Cache Keys

### Notification Settings
- **Pattern**: `settings:{userId}`
- **TTL**: 3600 seconds (1 hour)
- **Data**: User notification preferences

### Future Cache Keys (Planned)
- `notifications:{userId}:recent` - Recent notifications
- `templates:{type}` - Email templates
- `stats:daily:{date}` - Daily statistics

## API Endpoints

### Cache Management

#### Get Cache Statistics
```http
GET /notifications/cache/stats
```

Response:
```json
{
  "redisConnected": true,
  "cacheKeys": ["settings:user1", "settings:user2"]
}
```

#### Clear User Cache
```http
POST /notifications/cache/clear/{userId}
```

## Testing

### Unit Tests
- **RedisCacheService**: `src/cache/redis-cache.service.spec.ts`
- **NotificationService**: Enhanced with Redis cache testing

### Integration Tests
- **Cache Integration**: `src/cache/cache-integration.spec.ts`
- Tests graceful degradation when Redis is unavailable

### Running Tests

```bash
# Run all cache-related tests
npm test -- --testPathPatterns="cache"

# Run notification service tests (includes cache tests)
npm test -- --testPathPatterns="notification.service"

# Run integration tests
npm test -- --testPathPatterns="cache-integration"
```

## Monitoring

### Health Checks

The service provides cache health information through:

1. **Cache Stats Endpoint**: `/notifications/cache/stats`
2. **Service Logs**: Connection status and cache operations
3. **Redis Connection Status**: Available via `RedisCacheService.isRedisConnected()`

### Metrics to Monitor

- Redis connection status
- Cache hit/miss ratios
- Cache key count
- Memory usage
- Response times

## Performance Benefits

### MVP Benefits
- **Faster Response Times**: Settings cached in memory (< 1ms access)
- **Reduced Database Load**: Frequently accessed data served from cache
- **Graceful Degradation**: Service works even if Redis is unavailable

### Production Benefits
- **Scalability**: Redis cache shared across multiple service instances
- **Persistence**: Cache survives service restarts
- **Memory Efficiency**: Large datasets can be cached in Redis instead of memory

## Best Practices

### Cache Invalidation
- Settings cache is invalidated on updates
- Manual cache clearing available for troubleshooting
- TTL prevents stale data

### Error Handling
- All Redis operations have try/catch blocks
- Service continues to work if Redis is unavailable
- Detailed logging for troubleshooting

### Security
- Redis password support
- Cache endpoints require authentication
- Users can only clear their own cache (unless admin)

## Future Enhancements

### Planned Features
1. **Cache Warming**: Pre-populate cache with frequently accessed data
2. **Cache Analytics**: Detailed metrics on cache performance
3. **Distributed Caching**: Redis Cluster support for high availability
4. **Cache Compression**: Reduce memory usage for large objects
5. **Cache Partitioning**: Separate caches for different data types

### Configuration Options
1. **Cache Strategies**: LRU, LFU, TTL-based eviction
2. **Compression**: Enable/disable data compression
3. **Serialization**: Custom serialization strategies
4. **Monitoring**: Integration with monitoring tools (Prometheus, etc.)

## Troubleshooting

### Common Issues

#### Redis Connection Failed
```bash
# Check Redis is running
docker ps | grep redis

# Check Redis logs
docker logs notification-redis

# Test Redis connection
redis-cli -h localhost -p 6380 ping
```

#### Cache Not Working
```bash
# Check cache stats
curl -H "Authorization: Bearer <token>" \
  http://localhost:3003/notifications/cache/stats

# Clear cache for testing
curl -X POST -H "Authorization: Bearer <token>" \
  http://localhost:3003/notifications/cache/clear/{userId}
```

#### Performance Issues
- Monitor cache hit ratios
- Check Redis memory usage
- Review TTL settings
- Consider cache warming strategies

## Development

### Adding New Cache Types

1. **Define Cache Key Pattern**:
```typescript
private notificationsCacheKey(userId: string): string {
  return `notifications:${userId}:recent`;
}
```

2. **Implement Cache Logic**:
```typescript
async getRecentNotifications(userId: string): Promise<Notification[]> {
  const cacheKey = this.notificationsCacheKey(userId);
  
  // Try memory cache first
  let cached = await this.cacheManager.get<Notification[]>(cacheKey);
  if (cached) return cached;
  
  // Try Redis cache
  if (this.redisCacheService.isRedisConnected()) {
    cached = await this.redisCacheService.get<Notification[]>(cacheKey);
    if (cached) {
      await this.cacheManager.set(cacheKey, cached, 300); // 5 min TTL
      return cached;
    }
  }
  
  // Load from database
  const notifications = await this.loadRecentNotifications(userId);
  
  // Store in both caches
  await this.cacheManager.set(cacheKey, notifications, 300);
  if (this.redisCacheService.isRedisConnected()) {
    await this.redisCacheService.set(cacheKey, notifications, 300);
  }
  
  return notifications;
}
```

3. **Add Tests**:
```typescript
it('should cache recent notifications', async () => {
  // Test implementation
});
```

### Cache Configuration

The caching system is designed to be easily configurable:

```typescript
// In notification.module.ts
CacheModule.registerAsync({
  useFactory: (configService: ConfigService) => ({
    ttl: configService.get('CACHE_TTL', 3600),
    max: configService.get('CACHE_MAX_ITEMS', 1000),
    // Add more configuration options
  }),
})
```