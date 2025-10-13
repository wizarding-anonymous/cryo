# Auth Service Environment Configuration

## Overview

This document describes the environment configuration for the Auth Service microservice. The service supports multiple environments with different configuration profiles optimized for each use case.

## Environment Files

### Available Environment Files

- `.env.local` - Local development environment
- `.env.example` - Template for environment variables
- `.env.docker` - Docker container environment
- `.env.staging` - Staging environment
- `.env.production` - Production environment
- `.env.test` - Test environment

### Environment Selection

The service automatically selects the appropriate environment file based on the `NODE_ENV` variable:

```bash
NODE_ENV=development  # Uses .env.local
NODE_ENV=staging      # Uses .env.staging
NODE_ENV=production   # Uses .env.production
NODE_ENV=test         # Uses .env.test
```

## Configuration Categories

### 1. JWT Configuration (Requirement 9.1)

JWT tokens are configured with different security levels per environment:

#### Development
```env
JWT_SECRET=local-dev-jwt-secret-key-not-for-production
JWT_REFRESH_SECRET=local-dev-refresh-secret-key-not-for-production
JWT_EXPIRES_IN=2h
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=cryo-auth-service-local
JWT_AUDIENCE=cryo-platform-local
JWT_ALGORITHM=HS256
```

#### Production
```env
JWT_SECRET=${AUTH_JWT_SECRET}  # From environment variables
JWT_REFRESH_SECRET=${AUTH_JWT_REFRESH_SECRET}
JWT_EXPIRES_IN=15m  # Shorter for security
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=cryo-auth-service
JWT_AUDIENCE=cryo-platform
JWT_ALGORITHM=HS256
```

**Security Notes:**
- Production secrets MUST be set via environment variables
- Never commit production secrets to version control
- Use strong, randomly generated secrets (minimum 256 bits)
- Consider rotating secrets regularly

### 2. Redis Connection Parameters (Requirement 9.2)

Redis is used for token blacklisting, session storage, and event queuing:

#### Development
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
REDIS_DB=1
REDIS_URL=redis://:redis_password@localhost:6379/1
REDIS_TTL=3600
REDIS_MAX_RETRIES=2
REDIS_RETRY_DELAY=500
```

#### Production
```env
REDIS_HOST=${AUTH_REDIS_HOST}
REDIS_PORT=6379
REDIS_PASSWORD=${AUTH_REDIS_PASSWORD}
REDIS_DB=1
REDIS_URL=redis://:${AUTH_REDIS_PASSWORD}@${AUTH_REDIS_HOST}:6379/1
REDIS_TTL=86400
REDIS_MAX_RETRIES=5
REDIS_RETRY_DELAY=2000
```

**Configuration Notes:**
- Each environment uses different Redis databases (DB 1 for auth, DB 0 for general cache)
- Production has higher retry counts and longer TTL for stability
- Connection pooling is automatically managed by the Redis client

### 3. Service URL Configuration (Requirement 9.3)

Microservice integration URLs are configured per environment:

#### Development (Local)
```env
USER_SERVICE_URL=http://localhost:3002
SECURITY_SERVICE_URL=http://localhost:3010
NOTIFICATION_SERVICE_URL=http://localhost:3007
```

#### Docker Environment
```env
USER_SERVICE_URL=http://user-service:3002
SECURITY_SERVICE_URL=http://security-service:3010
NOTIFICATION_SERVICE_URL=http://notification-service:3007
```

#### Production
```env
USER_SERVICE_URL=${USER_SERVICE_URL}
SECURITY_SERVICE_URL=${SECURITY_SERVICE_URL}
NOTIFICATION_SERVICE_URL=${NOTIFICATION_SERVICE_URL}
```

**Integration Notes:**
- Docker environments use container names for service discovery
- Production URLs should be set via environment variables
- Health check endpoints are automatically derived from service URLs

### 4. General Environment Variables (Requirement 9.4)

#### Database Configuration
```env
DATABASE_HOST=${POSTGRES_AUTH_HOST}
DATABASE_PORT=5432
DATABASE_NAME=${POSTGRES_AUTH_DB}
DATABASE_USERNAME=${POSTGRES_AUTH_USER}
DATABASE_PASSWORD=${POSTGRES_AUTH_PASSWORD}
DATABASE_URL=postgresql://${POSTGRES_AUTH_USER}:${POSTGRES_AUTH_PASSWORD}@${POSTGRES_AUTH_HOST}:5432/${POSTGRES_AUTH_DB}
```

#### Circuit Breaker Configuration
```env
CIRCUIT_BREAKER_TIMEOUT=5000
CIRCUIT_BREAKER_ERROR_THRESHOLD=30
CIRCUIT_BREAKER_RESET_TIMEOUT=60000
USER_SERVICE_CIRCUIT_BREAKER_TIMEOUT=5000
SECURITY_SERVICE_CIRCUIT_BREAKER_TIMEOUT=10000
NOTIFICATION_SERVICE_CIRCUIT_BREAKER_TIMEOUT=10000
```

#### Session Management
```env
SESSION_CLEANUP_INTERVAL=1800000  # 30 minutes
SESSION_MAX_AGE=43200000          # 12 hours
MAX_SESSIONS_PER_USER=3
```

#### Rate Limiting
```env
RATE_LIMIT_WINDOW=60000           # 1 minute
RATE_LIMIT_MAX_REQUESTS=50
LOGIN_RATE_LIMIT_WINDOW=900000    # 15 minutes
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=3
```

## Environment-Specific Optimizations

### Development Environment
- Longer JWT expiration for convenience
- Lenient rate limiting
- Debug logging enabled
- Mock services available
- Lower security requirements

### Staging Environment
- Production-like configuration
- Moderate security settings
- Comprehensive logging
- Performance monitoring enabled

### Production Environment
- Maximum security settings
- Optimized performance parameters
- Minimal logging (warn level)
- High availability configuration
- Strict rate limiting

## Security Considerations

### Secret Management
1. **Never commit secrets to version control**
2. **Use environment variables for all sensitive data**
3. **Rotate secrets regularly**
4. **Use different secrets per environment**

### Network Security
1. **Use HTTPS in production**
2. **Configure proper CORS origins**
3. **Implement network segmentation**
4. **Use internal service discovery**

### Database Security
1. **Use dedicated database users per service**
2. **Implement connection pooling**
3. **Enable SSL connections in production**
4. **Regular backup and recovery testing**

## Deployment Instructions

### Local Development
```bash
cp .env.example .env.local
# Edit .env.local with your local settings
npm run start:dev
```

### Docker Deployment
```bash
# Uses .env.docker automatically
docker-compose up auth-service
```

### Production Deployment
```bash
# Set environment variables
export AUTH_JWT_SECRET="your-production-jwt-secret"
export AUTH_JWT_REFRESH_SECRET="your-production-refresh-secret"
export POSTGRES_AUTH_HOST="your-db-host"
export AUTH_REDIS_HOST="your-redis-host"
# ... other production variables

# Deploy with production config
NODE_ENV=production npm start
```

## Monitoring and Health Checks

### Health Check Endpoints
- `/health` - Overall service health
- `/health/ready` - Readiness probe for Kubernetes
- `/health/live` - Liveness probe for Kubernetes

### Metrics Configuration
```env
METRICS_RETENTION_HOURS=72
METRICS_AGGREGATION_INTERVAL=30000
METRICS_CLEANUP_INTERVAL=300000
```

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check REDIS_HOST and REDIS_PORT
   - Verify Redis password
   - Ensure Redis is running and accessible

2. **Database Connection Failed**
   - Verify DATABASE_URL format
   - Check database credentials
   - Ensure database exists and is accessible

3. **Service Integration Failed**
   - Check service URLs are correct
   - Verify services are running
   - Check network connectivity

4. **JWT Token Issues**
   - Verify JWT_SECRET is set correctly
   - Check token expiration settings
   - Ensure clock synchronization between services

### Debug Mode
Enable debug logging in development:
```env
LOG_LEVEL=debug
NODE_ENV=development
```

## Configuration Validation

The service validates all configuration on startup and will fail to start if required variables are missing or invalid. Check the startup logs for configuration validation errors.

## Environment Variables Reference

For a complete list of all available environment variables, see the `.env.example` file in the service root directory.