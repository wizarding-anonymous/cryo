# Game Catalog Service - Performance Guide

## 🎯 Performance Requirements

### Target Metrics (Production)
- **Response Time**: < 200ms (95th percentile)
- **Throughput**: 1000+ requests/second
- **Cache Hit Rate**: > 80%
- **Availability**: 99.9% uptime

## 🚀 Redis Cache Strategy

### Cache Configuration
- **Store**: Redis (production) with memory fallback
- **TTL**: 5 minutes (300 seconds)
- **Max Items**: 10,000 items
- **Database**: Redis DB 1 (dedicated for Game Catalog)
- **Connection**: Persistent with retry logic

### Cached Endpoints
1. **GET /api/games** - Game list with pagination
2. **GET /api/games/:id** - Individual game details
3. **GET /api/games/search** - Search results
4. **GET /api/games/:id/purchase-info** - Purchase information

### Cache Keys Pattern
```
game-catalog:games:list:page:{page}:limit:{limit}
game-catalog:games:detail:{gameId}
game-catalog:games:search:{query}:page:{page}
game-catalog:games:purchase:{gameId}
```

## 📊 Database Optimization

### Indexes (Implemented)
1. **Primary Index**: `id` (UUID, Primary Key)
2. **Availability Index**: `available` (Boolean)
3. **Genre Index**: `genre` (String)
4. **Price Index**: `price` (Numeric)
5. **Full-text Search**: `title` (Russian language)
6. **Composite Indexes**:
   - `available + genre`
   - `available + price`
   - `available + releaseDate`

### Query Optimization
- All queries use proper indexes
- Pagination implemented for large result sets
- Full-text search optimized for Russian language
- Connection pooling (max 10, min 2 connections)

## 🔧 Performance Testing

### Load Testing Commands
```bash
# Test database connection
docker-compose exec game-catalog-service npm run test:db:prod

# Test Redis connection
docker-compose exec game-catalog-service npm run test:redis

# Test API endpoints
curl http://localhost:3002/api/games
curl http://localhost:3002/api/games/search?q=cyberpunk
```

### Monitoring Endpoints
```bash
# Health check with performance metrics
curl http://localhost:3002/api/v1/health

# Prometheus metrics
curl http://localhost:3002/metrics
```

## 📈 Performance Benchmarks

### Expected Performance
- **Cold Start**: < 500ms (first request)
- **Cached Requests**: < 50ms
- **Database Queries**: < 100ms
- **Search Queries**: < 150ms

### Cache Performance
- **Hit Rate**: 80-90% for popular games
- **Miss Penalty**: < 200ms (database query + cache write)
- **Memory Usage**: ~100MB for 10,000 cached items

## 🚨 Performance Monitoring

### Key Metrics to Monitor
1. **Response Times**: P50, P95, P99 percentiles
2. **Cache Hit Rate**: Should be > 80%
3. **Database Connection Pool**: Usage and wait times
4. **Memory Usage**: Both application and Redis
5. **Error Rates**: 4xx and 5xx responses

### Alerting Thresholds
- Response time > 200ms (P95)
- Cache hit rate < 70%
- Error rate > 1%
- Database connections > 8/10
- Memory usage > 80%

## 🔄 Cache Invalidation Strategy

### Automatic Invalidation
- TTL-based expiration (5 minutes)
- Memory pressure eviction (LRU)

### Manual Invalidation (Future)
- Game updates trigger cache clear
- Price changes invalidate related caches
- Availability changes clear game caches

## 🎮 Production Optimization Tips

### 1. Database
- Use connection pooling
- Monitor slow queries
- Regular VACUUM and ANALYZE
- Consider read replicas for scaling

### 2. Redis
- Monitor memory usage
- Use appropriate data types
- Consider Redis Cluster for scaling
- Regular memory optimization

### 3. Application
- Enable compression for large responses
- Use streaming for large datasets
- Implement circuit breakers
- Monitor garbage collection

### 4. Infrastructure
- Use SSD storage for database
- Adequate RAM for Redis cache
- Network optimization between services
- Load balancing for multiple instances

## 📊 Performance Testing Results

### Baseline Performance (Expected)
```
Endpoint                    | Cached | Uncached | Target
---------------------------|--------|----------|--------
GET /api/games             | 45ms   | 120ms    | <200ms
GET /api/games/:id         | 35ms   | 80ms     | <200ms
GET /api/games/search      | 55ms   | 150ms    | <200ms
GET /api/games/:id/purchase| 40ms   | 90ms     | <200ms
```

### Load Testing (Expected)
```
Concurrent Users | RPS  | Avg Response | P95 Response
----------------|------|--------------|-------------
100             | 800  | 65ms         | 120ms
500             | 1200 | 95ms         | 180ms
1000            | 1500 | 125ms        | 195ms
```

## 🚀 Scaling Recommendations

### Horizontal Scaling
- Multiple service instances behind load balancer
- Shared Redis cache across instances
- Database read replicas

### Vertical Scaling
- Increase container memory for larger cache
- More CPU cores for concurrent processing
- Faster storage for database

### Cache Scaling
- Redis Cluster for distributed cache
- Cache warming strategies
- Regional cache distribution