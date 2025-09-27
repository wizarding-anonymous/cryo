# Docker Setup Guide for User Service

## Quick Start

### When to use Local Docker Compose
- ✅ Developing only user-service features
- ✅ Testing user-service in isolation
- ✅ Debugging user-service specific issues
- ✅ Faster startup (only 3 containers)
- ✅ Dedicated database and cache

```bash
npm run docker:local:up
```

### When to use Full Cryo Project
- ✅ Integration testing with other services
- ✅ Testing API Gateway routing
- ✅ End-to-end testing
- ✅ Simulating production environment
- ✅ Testing service-to-service communication

```bash
npm run docker:up-all
```

## Environment Files

| File | Purpose | Docker Compose |
|------|---------|----------------|
| `.env` | Local development (no Docker) | - |
| `.env.local` | Local Docker Compose | `user-service/docker-compose.yml` |
| `.env.docker` | Full Cryo project | `backend/docker-compose.yml` |

## Port Mapping

| Service | Local Dev | Local Docker | Full Cryo |
|---------|-----------|--------------|-----------|
| User Service | 3001 | 3001 | 3001 |
| PostgreSQL | 5432 | 5433 | 5432 |
| Redis | 6379 | 6380 | 6379 |

## Container Names

### Local Docker Compose
- `user-service-local`
- `user-service-postgres-local`
- `user-service-redis-local`

### Full Cryo Project
- `user-service`
- `postgres-user-db`
- `redis-cache` (shared)

## Common Commands

### Local Development
```bash
# Start
npm run docker:local:up

# View logs
npm run docker:local:logs

# Stop
npm run docker:local:down

# Rebuild
npm run docker:local:build
```

### Full Cryo Project
```bash
# Start user-service only
npm run docker:up

# Start all services
npm run docker:up-all

# View logs
npm run docker:logs

# Stop all
npm run docker:down
```

## Troubleshooting

### Port Conflicts
If you get port conflicts:
1. Stop other Docker containers: `docker stop $(docker ps -q)`
2. Or use different ports in docker-compose.yml

### Database Connection Issues
1. Check if PostgreSQL container is running: `docker ps`
2. Check logs: `npm run docker:local:logs`
3. Verify environment variables in `.env.local` or `.env.docker`

### Redis Connection Issues
1. For local: Redis has no password
2. For full project: Redis requires password `redis_password`