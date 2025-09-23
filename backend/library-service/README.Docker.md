# Library Service - Docker Setup

## Overview

This document describes how to run the Library Service using Docker containers with PostgreSQL database and Redis cache.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 18+ (for local development)

## Quick Start

### Development Environment

1. **Start all services:**
```bash
npm run docker:dev
```

This will start:
- Library Service (port 3000)
- PostgreSQL database (port 5432)
- Redis cache (port 6379)
- Mock services for external APIs (ports 3001-3003)

2. **Stop all services:**
```bash
npm run docker:dev:down
```

### Testing with Database

#### Linux/macOS:
```bash
npm run docker:test
```

#### Windows:
```bash
npm run docker:test:win
```

Available test options:
- `npm run docker:test unit` - Run unit tests only
- `npm run docker:test e2e` - Run E2E tests only
- `npm run docker:test coverage` - Run tests with coverage

## Production Build

### Build production image:
```bash
npm run docker:build
```

### Run production container:
```bash
npm run docker:run
```

## Services

### Library Service
- **Port:** 3000
- **Health Check:** http://localhost:3000/health
- **API Documentation:** http://localhost:3000/api (Swagger)

### PostgreSQL Database
- **Port:** 5432
- **Database:** library_service
- **Username:** postgres
- **Password:** password

### Redis Cache
- **Port:** 6379
- **No authentication in development**

### Mock Services

#### Game Catalog Service Mock
- **Port:** 3001
- **Base URL:** http://localhost:3001
- **Endpoints:**
  - `GET /api/games/:gameId` - Get game details
  - `GET /api/games?ids=...` - Get multiple games

#### User Service Mock
- **Port:** 3002
- **Base URL:** http://localhost:3002
- **Endpoints:**
  - `POST /api/auth/validate-token` - Validate JWT token
  - `GET /api/users/:userId` - Get user details

#### Payment Service Mock
- **Port:** 3003
- **Base URL:** http://localhost:3003
- **Endpoints:**
  - `GET /api/payments/:paymentId` - Get payment details
  - `POST /api/payments/webhook` - Payment webhook

## Environment Variables

### Development (.env)
```env
NODE_ENV=development
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=library_service
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=dev-secret-key
SERVICES_GAMES_CATALOG_URL=http://game-catalog-mock:3001
SERVICES_USER_SERVICE_URL=http://user-service-mock:3002
SERVICES_PAYMENT_SERVICE_URL=http://payment-service-mock:3003
```

### Production
```env
NODE_ENV=production
DATABASE_HOST=your-postgres-host
DATABASE_PORT=5432
DATABASE_USERNAME=your-username
DATABASE_PASSWORD=your-secure-password
DATABASE_NAME=library_service
REDIS_HOST=your-redis-host
REDIS_PORT=6379
JWT_SECRET=your-secure-jwt-secret
SERVICES_GAMES_CATALOG_URL=https://game-catalog.yourdomain.com
SERVICES_USER_SERVICE_URL=https://user-service.yourdomain.com
SERVICES_PAYMENT_SERVICE_URL=https://payment-service.yourdomain.com
```

## Database Migrations

### Run migrations in container:
```bash
docker-compose exec library-service npm run migration:run
```

### Generate new migration:
```bash
docker-compose exec library-service npm run migration:generate -- -n MigrationName
```

## Troubleshooting

### Database Connection Issues
1. Check if PostgreSQL container is running:
```bash
docker-compose ps postgres
```

2. Check database logs:
```bash
docker-compose logs postgres
```

3. Test database connection:
```bash
docker-compose exec postgres psql -U postgres -d library_service -c "SELECT 1;"
```

### Redis Connection Issues
1. Check if Redis container is running:
```bash
docker-compose ps redis
```

2. Test Redis connection:
```bash
docker-compose exec redis redis-cli ping
```

### Service Startup Issues
1. Check service logs:
```bash
docker-compose logs library-service
```

2. Rebuild containers:
```bash
docker-compose down
docker-compose up --build
```

### Mock Services Not Working
1. Check mock service logs:
```bash
docker-compose logs game-catalog-mock
docker-compose logs user-service-mock
docker-compose logs payment-service-mock
```

2. Verify mock expectations are loaded:
```bash
curl http://localhost:3001/mockserver/status
```

## Performance Optimization

### Database
- Connection pooling is configured in TypeORM
- Indexes are created via migrations
- Query optimization through proper entity relations

### Redis Caching
- Library data cached for 5 minutes
- Search results cached for 2 minutes
- User session data cached for 1 hour

### Container Resources
- Development: No limits set
- Production: Recommended limits:
  - CPU: 1 core
  - Memory: 512MB
  - Adjust based on load testing results

## Security Considerations

### Development
- Default passwords are used (not for production)
- All services run with default configurations
- Mock services expose all endpoints

### Production
- Use strong passwords and secrets
- Enable SSL/TLS for all connections
- Implement proper network segmentation
- Use secrets management (Docker Secrets, Kubernetes Secrets)
- Run containers as non-root users (already configured)

## Monitoring

### Health Checks
- Application: http://localhost:3000/health
- Database: Built into docker-compose
- Redis: Built into docker-compose

### Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f library-service

# With timestamps
docker-compose logs -f -t library-service
```

### Metrics
- Prometheus metrics available at http://localhost:3000/metrics
- Configure Grafana dashboard for visualization