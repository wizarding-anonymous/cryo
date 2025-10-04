# Game Catalog Service - Quick Start

## 🚀 Production Deployment (2-Minute Setup)

### Prerequisites
- Docker & Docker Compose installed
- Ports 3002, 5433, 6379 available

### Start Service
```bash
# 1. Navigate to backend directory
cd backend

# 2. Start database and Redis
docker-compose up -d postgres-catalog redis

# 3. Wait 30 seconds for services to initialize
sleep 30

# 4. Start the service
docker-compose up -d game-catalog-service

# 5. Run migrations (REQUIRED)
docker-compose exec game-catalog-service npm run migration:run

# 6. Test connections
docker-compose exec game-catalog-service npm run test:db:prod
docker-compose exec game-catalog-service npm run test:redis

# 7. Verify service is running
curl http://localhost:3002/api/v1/health
```

## ✅ Verification

### Health Check
```bash
curl http://localhost:3002/api/v1/health
# Expected: {"status":"ok","info":{"database":{"status":"up"},...}}
```

### Get Games
```bash
curl http://localhost:3002/api/games
# Expected: {"games":[...],"total":3,"page":1,"limit":20}
```

### Search Games
```bash
curl "http://localhost:3002/api/games/search?q=cyberpunk"
# Expected: {"games":[{"title":"Cyberpunk 2077",...}],...}
```

### API Documentation
Open: http://localhost:3002/api-docs

## 🔧 Management Commands

### Migration Management
```bash
# Check migration status
docker-compose exec game-catalog-service npm run migration:show

# Run migrations
docker-compose exec game-catalog-service npm run migration:run

# Revert last migration
docker-compose exec game-catalog-service npm run migration:revert
```

### Service Management
```bash
# View logs
docker-compose logs -f game-catalog-service

# Restart service
docker-compose restart game-catalog-service

# Stop all services
docker-compose down
```

## 🚨 Troubleshooting

### Service won't start
```bash
# Check if migrations were run
docker-compose exec game-catalog-service npm run migration:show

# Run migrations if needed
docker-compose exec game-catalog-service npm run migration:run
```

### Database connection issues
```bash
# Check database status
docker-compose ps postgres-catalog

# Test database connection
docker-compose exec game-catalog-service ./scripts/check-database.sh
```

### Reset everything
```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Start fresh
docker-compose up -d postgres-catalog redis
sleep 30
docker-compose up -d game-catalog-service
docker-compose exec game-catalog-service npm run migration:run
```

## 📋 Default Configuration

- **Service Port**: 3002
- **Database Port**: 5433 (mapped from container's 5432)
- **Redis Port**: 6379
- **API Prefix**: `/api`
- **Health Check**: `/api/v1/health`
- **API Docs**: `/api-docs`

## 🎯 Success Indicators

✅ Service is ready when:
- Health check returns `{"status":"ok"}`
- Games API returns sample data (3 games)
- Search API works with queries
- API documentation is accessible
- Logs show no errors

## 📚 Next Steps

- Read `README.md` for detailed documentation
- Check `DEPLOYMENT.md` for production deployment
- Review `MIGRATION_CHANGES.md` for migration details
- Explore API at http://localhost:3002/api-docs