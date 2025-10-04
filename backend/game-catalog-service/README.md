# Game Catalog Service

A production-ready microservice for managing game catalogs in a Russian gaming platform. Built with NestJS, TypeScript, PostgreSQL, and Redis for high performance and scalability.

## 🚀 Features

- **Game Catalog Management**: Browse, search, and retrieve game information
- **High Performance**: Redis caching with sub-200ms response times
- **Production Ready**: Docker containerization, health checks, monitoring
- **Comprehensive API**: RESTful API with full Swagger documentation
- **Search Functionality**: Full-text search with PostgreSQL and Russian language support
- **Payment Integration**: Specialized endpoints for Payment Service integration
- **100% Test Coverage**: Unit, integration, and e2e tests

## 📋 Prerequisites

### Development
- Node.js 18+ 
- npm 8+
- Docker & Docker Compose
- PostgreSQL 14+ (optional for local development)
- Redis 6+ (optional for local development)

### Production
- Kubernetes cluster
- PostgreSQL 14+ database
- Redis 6+ cache
- Container registry access

## 🛠️ Installation & Setup

### 1. Clone and Install Dependencies

```bash
# Navigate to the service directory
cd backend/game-catalog-service

# Install dependencies
npm install
```

### 2. Environment Configuration

Copy the appropriate environment file for your setup:

```bash
# For local development
cp .env.example .env

# For Docker development
cp .env.docker .env

# For production deployment
cp .env.production .env
```

### 3. Environment Variables

| Variable | Description | Development | Production |
|----------|-------------|-------------|------------|
| `NODE_ENV` | Application environment | `development` | `production` |
| `PORT` | Service port | `3002` | `3002` |
| `POSTGRES_HOST` | PostgreSQL hostname | `localhost` | `${POSTGRES_HOST}` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` | `${POSTGRES_PORT}` |
| `POSTGRES_USER` | Database username | `user` | `${POSTGRES_USER}` |
| `POSTGRES_PASSWORD` | Database password | `password` | `${POSTGRES_PASSWORD}` |
| `POSTGRES_DB` | Database name | `game_catalog_db` | `${POSTGRES_DB}` |
| `REDIS_HOST` | Redis hostname | `localhost` | `${REDIS_HOST}` |
| `REDIS_PORT` | Redis port | `6379` | `${REDIS_PORT}` |
| `JWT_SECRET` | JWT signing secret | `dev-secret` | `${JWT_SECRET}` |
| `CACHE_TTL` | Cache TTL (seconds) | `300` | `600` |
| `LOG_LEVEL` | Logging level | `debug` | `info` |
| `SWAGGER_ENABLED` | Enable Swagger docs | `true` | `false` |

## 🚀 Running the Application

### Option 1: Docker Compose (Recommended)

```bash
# 1. Start database and Redis first
docker-compose up -d postgres-catalog redis

# 2. Run migrations manually (REQUIRED)
docker-compose exec game-catalog-service npm run migration:run

# 3. Start the application
docker-compose up -d game-catalog-service

# Or start all services and run migrations separately
docker-compose up -d --build
docker-compose exec game-catalog-service npm run migration:run

# View logs
docker-compose logs -f game-catalog-service

# Stop services
docker-compose down
```

### Option 2: Local Development

```bash
# 1. Start database and Redis (if using Docker)
docker-compose up -d postgres-catalog redis

# 2. Run database migrations manually (REQUIRED)
npm run migration:run

# 3. Start the application in development mode
npm run start:dev

# Start in debug mode
npm run start:debug
```

### Option 3: Production Build

```bash
# Build the application
npm run build

# Start in production mode
npm run start:prod
```

## 📚 API Documentation

### Swagger/OpenAPI Documentation

Once the application is running, access the interactive API documentation:

- **Development**: `http://localhost:3002/api-docs`
- **Production**: Disabled by default for security

### Main API Endpoints

#### Games Management
- `GET /api/games` - Get paginated list of games
- `GET /api/games/:id` - Get game details by ID
- `GET /api/games/:id/purchase-info` - Get purchase information (Payment Service)

#### Search
- `GET /api/games/search` - Search games with filters

#### Health & Monitoring
- `GET /api/v1/health` - Comprehensive health check
- `GET /api/v1/health/ready` - Kubernetes readiness probe
- `GET /api/v1/health/live` - Kubernetes liveness probe
- `GET /metrics` - Prometheus metrics

### API Examples

#### Get Games with Pagination
```bash
curl "http://localhost:3002/api/games?page=1&limit=10&sortBy=title&sortOrder=ASC"
```

#### Search Games
```bash
curl "http://localhost:3002/api/games/search?q=cyberpunk&searchType=title&minPrice=100&maxPrice=5000"
```

#### Get Game Details
```bash
curl "http://localhost:3002/api/games/123e4567-e89b-12d3-a456-426614174000"
```

#### Health Check
```bash
curl "http://localhost:3002/api/v1/health"
```

## 🧪 Testing

### Run All Tests
```bash
# Unit tests
npm test

# Unit tests with coverage
npm run test:cov

# E2E tests
npm run test:e2e

# Integration tests
npm run test:integration

# All tests
npm run test:all
```

### Test Coverage
The service maintains 100% test coverage across:
- Unit tests for services and controllers
- Integration tests for database operations
- E2E tests for complete API workflows
- Error scenario testing

### Test Database
```bash
# Test database connection
npm run test:db

# Run specific integration tests
npm run test:integration:db
npm run test:integration:api
npm run test:integration:errors
```

## 🐳 Docker Deployment

### Build Docker Image
```bash
# Build production image
docker build -t game-catalog-service:latest .

# Build with specific tag
docker build -t game-catalog-service:v1.0.0 .
```

### Run Docker Container
```bash
# Run with environment file
docker run -d \
  --name game-catalog-service \
  --env-file .env.production \
  -p 3002:3002 \
  game-catalog-service:latest

# Run with individual environment variables
docker run -d \
  --name game-catalog-service \
  -e NODE_ENV=production \
  -e POSTGRES_HOST=your-db-host \
  -e REDIS_HOST=your-redis-host \
  -p 3002:3002 \
  game-catalog-service:latest
```

## ☸️ Kubernetes Deployment

### Prerequisites
- Kubernetes cluster (1.20+)
- kubectl configured
- Container registry access
- PostgreSQL and Redis services

### Deployment Steps

1. **Create Namespace**
```bash
kubectl create namespace gaming-platform
```

2. **Create Secrets**
```bash
# Database credentials
kubectl create secret generic game-catalog-db-secret \
  --from-literal=POSTGRES_USER=your-user \
  --from-literal=POSTGRES_PASSWORD=your-password \
  --from-literal=JWT_SECRET=your-jwt-secret \
  -n gaming-platform

# Redis credentials (if needed)
kubectl create secret generic game-catalog-redis-secret \
  --from-literal=REDIS_PASSWORD=your-redis-password \
  -n gaming-platform
```

3. **Create ConfigMap**
```bash
kubectl create configmap game-catalog-config \
  --from-literal=POSTGRES_HOST=postgres-service \
  --from-literal=POSTGRES_PORT=5432 \
  --from-literal=POSTGRES_DB=game_catalog_db \
  --from-literal=REDIS_HOST=redis-service \
  --from-literal=REDIS_PORT=6379 \
  --from-literal=NODE_ENV=production \
  --from-literal=PORT=3002 \
  --from-literal=LOG_LEVEL=info \
  -n gaming-platform
```

4. **Deploy Application**
```bash
# Apply Kubernetes manifests (create these based on your cluster setup)
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

### Sample Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: game-catalog-service
  namespace: gaming-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: game-catalog-service
  template:
    metadata:
      labels:
        app: game-catalog-service
    spec:
      containers:
      - name: game-catalog-service
        image: your-registry/game-catalog-service:latest
        ports:
        - containerPort: 3002
        envFrom:
        - configMapRef:
            name: game-catalog-config
        - secretRef:
            name: game-catalog-db-secret
        livenessProbe:
          httpGet:
            path: /api/v1/health/live
            port: 3002
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/health/ready
            port: 3002
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## 📊 Monitoring & Observability

### Health Checks
- **Comprehensive**: `/api/v1/health` - Full system health
- **Readiness**: `/api/v1/health/ready` - Ready to serve traffic
- **Liveness**: `/api/v1/health/live` - Application is alive

### Metrics
- **Prometheus**: `/metrics` - Application and system metrics
- **Performance**: Request duration, throughput, error rates
- **Business**: Game catalog size, search queries, cache hit rates

### Logging
- **Structured JSON logs** in production
- **Request/response logging** with correlation IDs
- **Error tracking** with stack traces
- **Performance monitoring** with execution times

## 🔧 Database Management

### Migrations

**⚠️ IMPORTANT: All migrations must be run manually for safety and control.**

#### Manual Migration Process

1. **Check Migration Status**
```bash
# Show current migration status
npm run migration:show

# Or use the migration script
./scripts/run-migrations.sh show
```

2. **Run Migrations**
```bash
# Run pending migrations manually
npm run migration:run

# Or use the interactive script
./scripts/run-migrations.sh run
```

3. **Revert Migrations (if needed)**
```bash
# Revert last migration
npm run migration:revert

# Or use the interactive script
./scripts/run-migrations.sh revert
```

#### Docker Environment

For Docker deployments, migrations must be run inside the container:

```bash
# Enter the container
docker exec -it game-catalog-service bash

# Run migrations inside container
npm run migration:run

# Or check status
npm run migration:show
```

#### Production Deployment Process

1. **Before Deployment**
```bash
# 1. Backup database
pg_dump -h $POSTGRES_HOST -U $POSTGRES_USER $POSTGRES_DB > backup.sql

# 2. Check migration status
npm run migration:show

# 3. Run migrations manually
npm run migration:run

# 4. Verify migrations
npm run migration:show
```

2. **Deploy Application**
```bash
# Deploy after migrations are complete
docker-compose up -d game-catalog-service
```

### Database Setup

```bash
# Initial database setup (run migrations)
npm run db:setup
```

### Migration Files

Current migrations:
- `1702000000000-CreateGamesTable.ts` - Creates games table with sample data
- `1703000000000-OptimizeGameIndexes.ts` - Adds performance indexes

### Migration Configuration

The service is configured for **manual migrations only**:

- **All Environments**: Migrations must be run manually using `npm run migration:run`
- **Docker**: Set `RUN_MIGRATIONS=false` to prevent automatic execution
- **Safety**: Manual execution prevents accidental schema changes

### Creating New Migrations

```bash
# Generate new migration based on entity changes
npm run migration:generate -- --name=AddNewFeature

# Create empty migration file
npm run migration:create -- --name=CustomMigration
```

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check database connectivity
   npm run test:db
   
   # Verify environment variables
   echo $POSTGRES_HOST $POSTGRES_PORT
   ```

2. **Redis Connection Issues**
   ```bash
   # Test Redis connection
   redis-cli -h $REDIS_HOST -p $REDIS_PORT ping
   ```

3. **Port Already in Use**
   ```bash
   # Find process using port 3002
   lsof -i :3002
   
   # Kill process
   kill -9 <PID>
   ```

4. **Docker Build Issues**
   ```bash
   # Clean Docker cache
   docker system prune -a
   
   # Rebuild without cache
   docker build --no-cache -t game-catalog-service .
   ```

### Performance Issues

1. **Slow Database Queries**
   - Check database indexes
   - Monitor query execution plans
   - Verify connection pool settings

2. **Cache Miss Issues**
   - Verify Redis connectivity
   - Check cache TTL settings
   - Monitor cache hit rates

3. **High Memory Usage**
   - Check for memory leaks
   - Monitor heap usage
   - Adjust Node.js memory limits

## 📈 Performance Benchmarks

### Target Performance Metrics
- **Response Time**: < 200ms (95th percentile)
- **Throughput**: 1000+ requests/second
- **Availability**: 99.9% uptime
- **Cache Hit Rate**: > 80%

### Load Testing
```bash
# Install artillery for load testing
npm install -g artillery

# Run load test
artillery run load-test.yml
```

## 🔐 Security

### Security Features
- **Input validation** with class-validator
- **SQL injection protection** via TypeORM
- **Rate limiting** to prevent abuse
- **CORS configuration** for cross-origin requests
- **Helmet.js** for security headers
- **Non-root Docker user** for container security

### Security Best Practices
- Use environment variables for secrets
- Enable HTTPS in production
- Implement proper authentication
- Regular security updates
- Monitor for vulnerabilities

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run full test suite
5. Submit pull request

### Code Standards
- **TypeScript** with strict mode
- **ESLint** for code quality
- **Prettier** for formatting
- **100% test coverage** requirement
- **Conventional commits** for changelog

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation
- Contact the development team

---

**Game Catalog Service** - Part of the Russian Gaming Platform MVP
