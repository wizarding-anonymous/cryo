# Docker Naming Changes for User Service

## Overview
User-service has been integrated into the main Cryo project docker-compose setup. Instead of having isolated containers, it now uses shared infrastructure (PostgreSQL and Redis) with proper naming conventions to avoid conflicts.

## Integration Approach

### Two Docker Compose Options

#### 1. Local Development (Isolated)
- **File**: `backend/user-service/docker-compose.yml`
- **Environment**: `.env.local`
- **Dedicated Infrastructure**: Own PostgreSQL and Redis instances
- **Ports**: 5433 (PostgreSQL), 6380 (Redis) to avoid conflicts
- **Use Case**: Isolated development and testing

#### 2. Full Cryo Project
- **File**: `backend/docker-compose.yml`
- **Environment**: `.env.docker`
- **Shared Infrastructure**: Common Redis with password, dedicated PostgreSQL
- **Ports**: Standard ports (5432, 6379)
- **Use Case**: Integration testing with other microservices

## Changes Made

### Docker Compose (`docker-compose.yml`)
- **Container Names**:
  - `postgres_user_db` → `user-service-postgres`
  - `redis_cache` → `user-service-redis`
  - `user-service` (unchanged, already correct)

- **Network**:
  - `my-network` → `user-service-network`

- **Volumes**:
  - `postgres_data` → `user-service-postgres-data`
  - `redis_data` → `user-service-redis-data`

- **External Ports** (to avoid conflicts):
  - PostgreSQL: `5432:5432` → `5433:5432`
  - Redis: `6379:6379` → `6380:6379`

- **Environment File**:
  - Now uses `.env.docker` instead of `.env` for Docker-specific configuration

### Kubernetes Configuration

#### New Files Created:
- `k8s/postgres-deployment.yaml` - Dedicated PostgreSQL deployment for user-service
- `k8s/redis-deployment.yaml` - Dedicated Redis deployment for user-service

#### Updated Files:
- `k8s/configmap.yaml`:
  - `POSTGRES_HOST`: `postgres-service` → `user-service-postgres`
  - `REDIS_HOST`: `redis-service` → `user-service-redis`
- `k8s/kustomization.yaml` - Added new resource files

#### Resource Names:
All Kubernetes resources use `user-service-` prefix:
- Services: `user-service-postgres`, `user-service-redis`
- Deployments: `user-service-postgres`, `user-service-redis`
- PVCs: `user-service-postgres-pvc`, `user-service-redis-pvc`
- ConfigMaps: `user-service-config`
- Secrets: `user-service-secret`

### Environment Configuration

#### New Files:
- `.env.docker` - Full Cryo project Docker Compose environment variables
- `.env.local` - Local Docker Compose environment variables
- `docker-compose.yml` - Local development Docker Compose (recreated)

#### Updated Files:
- `.env.example` - Updated port comments to reflect Docker port mapping

### Documentation and Scripts

#### Updated Files:
- `README.md` - Added Docker configuration section with new port information
- `package.json` - Added Docker convenience scripts:
  - `docker:up` - Start services
  - `docker:down` - Stop services
  - `docker:logs` - View application logs
  - `docker:build` - Build containers
  - `docker:restart` - Restart application container

## Port Mapping Summary

### Local Development
- Application: 3001
- PostgreSQL: 5432 (direct connection)
- Redis: 6379 (direct connection)

### Local Docker Compose
- Application: 3001
- PostgreSQL: 5433 (host) → 5432 (container)
- Redis: 6380 (host) → 6379 (container)

### Full Cryo Project
- Application: 3001
- PostgreSQL: 5432 (shared database server)
- Redis: 6379 (shared cache server)

### Kubernetes
- Application: 3001 (internal cluster communication)
- PostgreSQL: 5432 (internal cluster communication)
- Redis: 6379 (internal cluster communication)

## Usage

### Docker Compose Usage

#### Local Development (Isolated)
```bash
# From user-service directory:
npm run docker:local:up
npm run docker:local:logs
npm run docker:local:down
```

#### Full Cryo Project
```bash
# From user-service directory:
npm run docker:up          # Start user-service in main compose
npm run docker:up-all      # Start all microservices
npm run docker:logs        # View logs
npm run docker:down        # Stop all services

# Or from backend directory:
docker-compose up -d user-service
docker-compose logs -f user-service
docker-compose down
```

### Kubernetes
```bash
# Apply all configurations
kubectl apply -k k8s/

# Check status
kubectl get pods -n gaming-platform -l service=user-service
```

## Benefits
1. **No Naming Conflicts**: All resources are prefixed with `user-service-`
2. **Port Isolation**: Different external ports prevent conflicts when running multiple services
3. **Clear Separation**: Each microservice has its own database and cache instances
4. **Maintainability**: Easy to identify which resources belong to user-service
5. **Scalability**: Each service can be scaled independently