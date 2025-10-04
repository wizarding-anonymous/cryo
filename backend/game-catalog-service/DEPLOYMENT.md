# Game Catalog Service - Deployment Guide

## 🚀 Quick Start

### 1. Manual Migration Deployment (Recommended)

```bash
# 1. Start database and Redis
cd backend
docker-compose up -d postgres-catalog redis

# 2. Wait for database to be ready (30 seconds)
sleep 30

# 3. Run migrations manually (REQUIRED)
docker-compose exec game-catalog-service npm run migration:run

# 4. Start the service
docker-compose up -d game-catalog-service

# 5. Verify service is running
curl http://localhost:3002/api/v1/health
```

### 2. Full Stack Deployment

```bash
# 1. Start all services
cd backend
docker-compose up -d --build

# 2. Run migrations manually (REQUIRED)
docker-compose exec game-catalog-service npm run migration:run

# 3. Verify all services
docker-compose ps
curl http://localhost:3002/api/v1/health
```

## 🔧 Migration Management

### Check Migration Status
```bash
# Inside container
docker-compose exec game-catalog-service npm run migration:show

# Or use the migration script
docker-compose exec game-catalog-service ./scripts/run-migrations.sh show
```

### Run Migrations
```bash
# Interactive migration
docker-compose exec game-catalog-service ./scripts/run-migrations.sh run

# Direct migration
docker-compose exec game-catalog-service npm run migration:run
```

### Revert Migrations (if needed)
```bash
# Interactive revert
docker-compose exec game-catalog-service ./scripts/run-migrations.sh revert

# Direct revert
docker-compose exec game-catalog-service npm run migration:revert
```

## 🏥 Health Checks

### Service Health
```bash
# Comprehensive health check
curl http://localhost:3002/api/v1/health

# Readiness probe
curl http://localhost:3002/api/v1/health/ready

# Liveness probe
curl http://localhost:3002/api/v1/health/live
```

### Database Connection
```bash
# Test database connection
docker-compose exec game-catalog-service ./scripts/check-database.sh

# Or test directly
docker-compose exec game-catalog-service npm run test:db
```

## 📊 Monitoring

### View Logs
```bash
# Service logs
docker-compose logs -f game-catalog-service

# Database logs
docker-compose logs -f postgres-catalog

# All logs
docker-compose logs -f
```

### Metrics
```bash
# Prometheus metrics
curl http://localhost:3002/metrics

# API documentation
open http://localhost:3002/api-docs
```

## 🚨 Troubleshooting

### Common Issues

1. **Service won't start**
   ```bash
   # Check if migrations were run
   docker-compose exec game-catalog-service npm run migration:show
   
   # Run migrations if needed
   docker-compose exec game-catalog-service npm run migration:run
   ```

2. **Database connection failed**
   ```bash
   # Check database status
   docker-compose ps postgres-catalog
   
   # Test connection
   docker-compose exec game-catalog-service ./scripts/check-database.sh
   ```

3. **Port conflicts**
   ```bash
   # Check what's using port 3002
   netstat -an | findstr :3002
   
   # Stop conflicting services
   docker-compose down
   ```

### Reset Everything
```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: This deletes all data)
docker-compose down -v

# Rebuild and restart
docker-compose up -d --build

# Run migrations
docker-compose exec game-catalog-service npm run migration:run
```

## 🔐 Production Deployment

### Pre-deployment Checklist
- [ ] Database backup completed
- [ ] Migration status verified
- [ ] Environment variables configured
- [ ] SSL certificates ready
- [ ] Monitoring configured

### Production Migration Process
```bash
# 1. Backup database
pg_dump -h $POSTGRES_HOST -U $POSTGRES_USER $POSTGRES_DB > backup.sql

# 2. Run migrations
npm run migration:run

# 3. Verify migrations
npm run migration:show

# 4. Deploy application
docker-compose up -d game-catalog-service

# 5. Health check
curl https://your-domain.com/api/v1/health
```

## 📋 Environment Variables

### Required Variables
- `POSTGRES_HOST` - Database hostname
- `POSTGRES_PORT` - Database port (default: 5432)
- `POSTGRES_USER` - Database username
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_DB` - Database name
- `REDIS_HOST` - Redis hostname
- `REDIS_PORT` - Redis port (default: 6379)

### Optional Variables
- `NODE_ENV` - Environment (development/production)
- `PORT` - Service port (default: 3002)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)
- `CACHE_TTL` - Cache TTL in seconds (default: 300)

## 🎯 Success Criteria

After deployment, verify:
- [ ] Service responds to health checks
- [ ] Database migrations are complete
- [ ] API endpoints return data
- [ ] Cache is working (Redis connected)
- [ ] Logs are being generated
- [ ] Metrics are available

### Test Commands
```bash
# Health check
curl http://localhost:3002/api/v1/health

# Get games
curl http://localhost:3002/api/games

# Search games
curl "http://localhost:3002/api/games/search?q=cyberpunk"

# Metrics
curl http://localhost:3002/metrics
```