# Production Deployment Guide - Game Catalog Service

## 🚀 Production Readiness Checklist

### ✅ Database Configuration
- [x] PostgreSQL with connection pooling
- [x] Separate database instance (postgres-catalog:5433)
- [x] Persistent volumes for data
- [x] Environment-based configuration
- [x] Migration system configured

### ✅ Caching
- [x] Redis configuration with fallback
- [x] Shared Redis instance with password protection
- [x] Cache key management utilities
- [x] Production TTL settings (5 minutes)

### ✅ Docker Configuration
- [x] Multi-stage Dockerfile
- [x] Non-root user security
- [x] Health checks
- [x] Resource limits
- [x] Restart policies

### ✅ Monitoring & Logging
- [x] Prometheus metrics
- [x] Grafana dashboards
- [x] ELK stack logging
- [x] Health check endpoints

## 🔧 Deployment Steps

### 1. Pre-deployment Setup

```bash
# Navigate to backend directory
cd backend

# Copy environment files
cp game-catalog-service/.env.example game-catalog-service/.env.docker

# Update production secrets in .env.docker:
# - JWT_SECRET (generate strong secret)
# - REDIS_PASSWORD (match with docker-compose)
# - Database credentials (if different)
```

### 2. Database Migration

```bash
# Run migrations before starting services
docker-compose run --rm game-catalog-service ./scripts/run-migrations-docker.sh

# Or manually:
docker-compose run --rm game-catalog-service npm run migration:run
```

### 3. Start Services

```bash
# Development
docker-compose up -d

# Production with resource limits
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 4. Verify Deployment

```bash
# Check service health
curl http://localhost:3002/health

# Check database connection
docker-compose exec game-catalog-service npm run test:db

# Check Redis connection
docker-compose exec game-catalog-service npm run test:redis

# View logs
docker-compose logs -f game-catalog-service
```

## 🔒 Security Considerations

### Environment Variables
- **JWT_SECRET**: Generate strong random secret (32+ characters)
- **REDIS_PASSWORD**: Use strong password for Redis
- **Database credentials**: Use strong passwords

### Network Security
- Services communicate through internal Docker network
- Only necessary ports exposed to host
- Redis protected with password

### Container Security
- Non-root user (nestjs:nodejs)
- Minimal Alpine Linux base image
- No unnecessary packages installed

## 📊 Monitoring

### Health Checks
- **Application**: `GET /health`
- **Database**: Built-in TypeORM health check
- **Redis**: Connection validation
- **Docker**: Container health checks every 30s

### Metrics
- **Prometheus**: Metrics collection on port 9090
- **Grafana**: Dashboards on port 3100
- **Application metrics**: Custom NestJS metrics

### Logging
- **Format**: JSON for production
- **Level**: INFO (configurable via LOG_LEVEL)
- **Destination**: ELK stack (Elasticsearch, Logstash, Kibana)

## 🔄 Scaling

### Horizontal Scaling
```yaml
# In docker-compose.prod.yml
game-catalog-service:
  deploy:
    replicas: 2  # Can be increased
    resources:
      limits:
        cpus: '1.0'
        memory: 512M
```

### Database Scaling
- Connection pooling configured (max: 20, min: 5)
- Read replicas can be added for read-heavy workloads
- Database indexes optimized for queries

### Cache Scaling
- Redis shared between service instances
- Cache TTL optimized for performance (5 minutes)
- Memory fallback for Redis unavailability

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check database status
   docker-compose ps postgres-catalog
   
   # Check logs
   docker-compose logs postgres-catalog
   
   # Test connection
   docker-compose exec game-catalog-service npm run test:db
   ```

2. **Redis Connection Issues**
   ```bash
   # Check Redis status
   docker-compose ps redis
   
   # Test Redis connection
   docker-compose exec game-catalog-service npm run test:redis
   ```

3. **Migration Issues**
   ```bash
   # Check migration status
   docker-compose exec game-catalog-service npm run migration:show
   
   # Run migrations manually
   docker-compose exec game-catalog-service npm run migration:run
   ```

### Performance Tuning

1. **Database Performance**
   - Monitor connection pool usage
   - Optimize queries with EXPLAIN ANALYZE
   - Consider read replicas for heavy read workloads

2. **Cache Performance**
   - Monitor cache hit rates
   - Adjust TTL based on data update frequency
   - Consider cache warming strategies

3. **Application Performance**
   - Monitor memory usage and GC
   - Use Node.js profiling tools
   - Optimize TypeORM queries

## 📋 Maintenance

### Regular Tasks
- Monitor disk usage for database volumes
- Review and rotate logs
- Update dependencies regularly
- Monitor security vulnerabilities
- Backup database regularly

### Updates
```bash
# Update application
docker-compose pull game-catalog-service
docker-compose up -d game-catalog-service

# Update with migrations
docker-compose run --rm game-catalog-service ./scripts/run-migrations-docker.sh
docker-compose up -d game-catalog-service
```

## 🎯 Production Checklist

- [ ] Environment variables configured with production values
- [ ] JWT_SECRET generated and secured
- [ ] Database migrations executed
- [ ] Health checks responding
- [ ] Monitoring dashboards configured
- [ ] Log aggregation working
- [ ] Backup strategy implemented
- [ ] SSL certificates configured (if applicable)
- [ ] Load balancer configured (if using multiple instances)
- [ ] Security scanning completed