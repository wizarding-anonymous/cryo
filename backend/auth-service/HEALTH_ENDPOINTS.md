# Health Check Endpoints

This document describes the health check endpoints implemented for the Auth Service as part of task 10.3.

## Overview

The Auth Service provides comprehensive health monitoring endpoints for Kubernetes deployment, service monitoring, and dependency verification.

## Endpoints

### 1. Main Health Check - `/api/health`

**Purpose**: Comprehensive health check for all service dependencies  
**Method**: GET  
**Kubernetes Usage**: Can be used for both liveness and readiness probes  

**Health Indicators**:
- ✅ Database connectivity and response time
- ✅ Redis connectivity and response time  
- ✅ Memory usage (heap and RSS)
- ✅ External service availability (optional)

**Response Codes**:
- `200` - All health indicators are healthy
- `503` - One or more health indicators are unhealthy

### 2. Readiness Probe - `/api/health/ready`

**Purpose**: Kubernetes readiness probe endpoint  
**Method**: GET  
**Usage**: Determines if pod should receive traffic  

**Response**: Always returns `200` if service has started successfully

```json
{
  "status": "ready",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 3. Liveness Probe - `/api/health/live`

**Purpose**: Kubernetes liveness probe endpoint  
**Method**: GET  
**Usage**: Determines if pod should be restarted  

**Response**: Simple health check without dependency verification

```json
{
  "status": "alive", 
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 4. Redis Health Check - `/api/health/redis`

**Purpose**: Detailed Redis connectivity and performance monitoring  
**Method**: GET  
**Usage**: Monitor Redis cache and token blacklist functionality  

**Features Tested**:
- ✅ Basic Redis operations (set/get/delete)
- ✅ Token blacklist functionality
- ✅ Response time measurement
- ✅ Connection status verification

**Response Example**:
```json
{
  "connected": true,
  "responseTime": 45.2,
  "status": "healthy",
  "features": {
    "basicOperations": true,
    "tokenBlacklist": true
  },
  "performance": {
    "pingResponseTime": 45.2,
    "connectionStatus": "active"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 5. Database Health Check - `/api/health/database`

**Purpose**: Comprehensive database health and migration status  
**Method**: GET  
**Usage**: Monitor database connectivity and migration state  

**Information Provided**:
- Connection status and response time
- Migration status and history
- Database version and configuration
- Active connection count

### 6. Circuit Breaker Monitoring - `/api/health/circuit-breakers`

**Purpose**: Monitor circuit breaker states for external service integrations  
**Method**: GET  
**Usage**: Track service resilience and failure patterns  

**Monitored Services**:
- User Service integration
- Security Service integration  
- Notification Service integration

## Memory Usage Monitoring

The main health endpoint includes memory usage checks:

- **Heap Memory**: Monitors JavaScript heap usage (limit: 150MB)
- **RSS Memory**: Monitors Resident Set Size (limit: 150MB)

## Kubernetes Configuration

### Recommended Probe Configuration

```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: auth-service
    image: auth-service:latest
    ports:
    - containerPort: 3001
    livenessProbe:
      httpGet:
        path: /api/health/live
        port: 3001
      initialDelaySeconds: 30
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /api/health/ready
        port: 3001
      initialDelaySeconds: 5
      periodSeconds: 5
      timeoutSeconds: 3
      failureThreshold: 3
```

### Advanced Health Check (Optional)

For more comprehensive monitoring, you can use the main health endpoint:

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3001
  initialDelaySeconds: 60
  periodSeconds: 30
  timeoutSeconds: 10
  failureThreshold: 3
```

## Health Check Script

A standalone health check script is provided at `health-check.js`:

```bash
# Check all endpoints
node health-check.js

# Check specific endpoint
node health-check.js --endpoint /api/health/redis

# Use custom port
PORT=3002 node health-check.js
```

## Monitoring Integration

### Prometheus Metrics

The health endpoints can be integrated with Prometheus for monitoring:

- Response times for all dependencies
- Success/failure rates
- Memory usage trends
- Circuit breaker state changes

### Alerting

Recommended alerts:
- Database connectivity failures
- Redis connectivity issues
- High memory usage (>80% of limit)
- Circuit breaker state changes
- Health check failures

## Requirements Compliance

This implementation satisfies requirement **9.6** from the Auth Service migration specification:

✅ **Implement /health endpoint with service dependency checks**  
✅ **Add /health/ready and /health/live endpoints for Kubernetes**  
✅ **Include Redis connectivity and memory usage monitoring**  

## Testing

Unit tests are provided in `src/health/health.controller.spec.ts` covering:

- ✅ Readiness and liveness endpoints
- ✅ Redis health check scenarios (success/failure)
- ✅ Database health information retrieval
- ✅ Circuit breaker statistics

Run tests with:
```bash
npm test -- health.controller.spec.ts
```