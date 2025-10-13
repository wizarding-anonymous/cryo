# Auth Service Monitoring and Observability

This document describes the comprehensive monitoring and observability implementation for the Auth Service, covering Prometheus metrics, structured logging with correlation IDs, and alerting for authentication failures and service issues.

## Overview

The monitoring system provides:
- **Prometheus Metrics**: Comprehensive metrics for authentication operations, performance, and system health
- **Structured Logging**: Correlation ID-based logging for request tracing and debugging
- **Alerting System**: Automated alerts for authentication failures, service issues, and performance problems
- **Observability**: Full visibility into service behavior and performance

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Auth Service  │───▶│  Prometheus      │───▶│   Grafana       │
│                 │    │  Metrics         │    │   Dashboard     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Structured      │───▶│  Winston Logger  │───▶│   Log Files     │
│ Logging         │    │  with Correlation│    │   & Console     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Alert Rules     │───▶│  Alert Manager   │───▶│   Slack/Webhook │
│ Engine          │    │                  │    │   Notifications │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Prometheus Metrics

### Authentication Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `auth_operations_total` | Counter | Total authentication operations | `operation`, `status`, `method` |
| `auth_operation_duration_seconds` | Histogram | Duration of auth operations | `operation`, `status` |
| `auth_active_sessions_total` | Gauge | Number of active sessions | - |
| `auth_failures_total` | Counter | Authentication failures | `reason`, `endpoint` |

### Token Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `auth_token_operations_total` | Counter | Token operations | `operation`, `status` |
| `auth_blacklisted_tokens_total` | Gauge | Blacklisted tokens count | - |

### External Service Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `auth_external_service_calls_total` | Counter | External service calls | `service`, `operation`, `status` |
| `auth_external_service_call_duration_seconds` | Histogram | External call duration | `service`, `operation` |
| `auth_circuit_breaker_state` | Gauge | Circuit breaker state | `service` |

### System Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `auth_rate_limit_hits_total` | Counter | Rate limit hits | `endpoint`, `ip` |
| `auth_redis_operations_total` | Counter | Redis operations | `operation`, `status` |
| `auth_db_operations_total` | Counter | Database operations | `operation`, `entity`, `status` |

## Structured Logging

### Correlation IDs

Every request gets a unique correlation ID that tracks the request through all services:

```typescript
// Automatic correlation ID generation
X-Correlation-ID: auth-550e8400-e29b-41d4-a716-446655440000
X-Request-ID: req-6ba7b810-9dad-11d1-80b4-00c04fd430c8
```

### Log Structure

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "User login successful",
  "service": "auth-service",
  "correlationId": "auth-550e8400-e29b-41d4-a716-446655440000",
  "requestId": "req-6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "userId": "user-123",
  "sessionId": "session-456",
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "duration": 245,
  "category": "authentication",
  "authOperation": "login",
  "success": true,
  "metadata": {
    "email": "user@example.com"
  }
}
```

### Log Categories

- **authentication**: Login, logout, registration operations
- **security**: Security events, suspicious activities
- **external-service**: Calls to User, Security, Notification services
- **database**: Database operations and queries
- **performance**: Performance metrics and slow operations
- **business**: Business logic events
- **rate-limit**: Rate limiting events
- **circuit-breaker**: Circuit breaker state changes

## Alerting System

### Alert Rules

#### Authentication Alerts

1. **High Authentication Failure Rate**
   - Condition: Failure rate > 20% in 5 minutes
   - Severity: High
   - Cooldown: 15 minutes

2. **Multiple Failed Login Attempts**
   - Condition: >10 failed logins from same IP in 5 minutes
   - Severity: Medium
   - Cooldown: 10 minutes

3. **Suspicious Activity Detected**
   - Condition: Unusual authentication patterns
   - Severity: High
   - Cooldown: 5 minutes

#### Service Health Alerts

4. **External Service Unavailable**
   - Condition: Service error rate > 90% for 2 minutes
   - Severity: Critical
   - Cooldown: 5 minutes

5. **High Response Time**
   - Condition: Average response time > 2 seconds
   - Severity: Medium
   - Cooldown: 10 minutes

6. **Circuit Breaker Open**
   - Condition: Circuit breaker is open
   - Severity: High
   - Cooldown: 5 minutes

#### System Resource Alerts

7. **High Memory Usage**
   - Condition: Memory usage > 85%
   - Severity: High
   - Cooldown: 5 minutes

8. **Database Connection Issues**
   - Condition: DB error rate > 10%
   - Severity: Critical
   - Cooldown: 5 minutes

9. **Redis Connection Issues**
   - Condition: Redis error rate > 5%
   - Severity: High
   - Cooldown: 5 minutes

### Alert Channels

#### Log Channel
- All alerts logged to structured logs
- Always enabled

#### Webhook Channel
- Critical and high severity alerts
- Configurable via `ALERT_WEBHOOK_URL`

#### Slack Channel
- High and critical alerts
- Configurable via `SLACK_WEBHOOK_URL`

## Configuration

### Environment Variables

```bash
# Monitoring Configuration
LOG_LEVEL=info
STRUCTURED_LOGGING=true
PROMETHEUS_METRICS=true
METRICS_PORT=9090

# Alerting Configuration
ALERT_WEBHOOK_URL=https://your-webhook.com/alerts
ALERT_WEBHOOK_TOKEN=your-webhook-token
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_CHANNEL=#alerts
ALERT_EVALUATION_INTERVAL=60000

# Alert Thresholds
AUTH_FAILURE_RATE_THRESHOLD=0.2
FAILED_LOGINS_PER_IP_THRESHOLD=10
RESPONSE_TIME_THRESHOLD=2000
MEMORY_USAGE_THRESHOLD=85
RATE_LIMIT_HITS_THRESHOLD=50
DB_ERROR_RATE_THRESHOLD=0.1
REDIS_ERROR_RATE_THRESHOLD=0.05

# Correlation and Tracing
CORRELATION_ID_HEADER=x-correlation-id
REQUEST_ID_HEADER=x-request-id
TRACE_REQUESTS=true
```

## API Endpoints

### Metrics Endpoints

```bash
# Prometheus metrics
GET /metrics

# Authentication-specific metrics
GET /metrics/auth
```

### Monitoring Endpoints

```bash
# System status
GET /monitoring/status

# Alert rules management
GET /monitoring/alerts/rules
POST /monitoring/alerts/rules/{ruleId}/enable
POST /monitoring/alerts/rules/{ruleId}/disable

# Alert history and statistics
GET /monitoring/alerts/history?limit=100
GET /monitoring/alerts/stats

# Alert channels management
GET /monitoring/alerts/channels
POST /monitoring/alerts/channels/{channelId}/enable
POST /monitoring/alerts/channels/{channelId}/disable

# Testing and manual triggers
POST /monitoring/alerts/test
POST /monitoring/alerts/evaluate
```

## Usage Examples

### Viewing Metrics

```bash
# Get all Prometheus metrics
curl http://localhost:3001/metrics

# Get authentication-specific metrics
curl http://localhost:3001/metrics/auth
```

### Managing Alerts

```bash
# Get alert rules
curl http://localhost:3001/monitoring/alerts/rules

# Disable a specific rule
curl -X POST http://localhost:3001/monitoring/alerts/rules/auth-failure-rate-high/disable

# Test alert system
curl -X POST http://localhost:3001/monitoring/alerts/test \
  -H "Content-Type: application/json" \
  -d '{"severity": "medium"}'

# Get alert history
curl http://localhost:3001/monitoring/alerts/history?limit=50
```

### Correlation ID Tracing

```bash
# Make request with correlation ID
curl -H "X-Correlation-ID: my-trace-123" \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com", "password": "password"}' \
     http://localhost:3001/api/auth/login

# All logs for this request will include correlationId: "my-trace-123"
```

## Grafana Dashboard

### Key Panels

1. **Authentication Overview**
   - Total auth operations
   - Success/failure rates
   - Active sessions

2. **Performance Metrics**
   - Response times
   - Operation durations
   - Throughput

3. **Error Tracking**
   - Error rates by service
   - Failed login attempts
   - Circuit breaker states

4. **System Health**
   - Memory usage
   - Database connections
   - Redis operations

### Sample Queries

```promql
# Authentication success rate
rate(auth_operations_total{status="success"}[5m]) / rate(auth_operations_total[5m])

# Average response time
rate(auth_operation_duration_seconds_sum[5m]) / rate(auth_operation_duration_seconds_count[5m])

# Active sessions
auth_active_sessions_total

# Error rate by service
rate(auth_external_service_calls_total{status="failure"}[5m]) by (service)
```

## Troubleshooting

### Common Issues

1. **Missing Metrics**
   - Check `PROMETHEUS_METRICS=true` in environment
   - Verify `/metrics` endpoint is accessible
   - Check for errors in application logs

2. **Alerts Not Firing**
   - Verify alert rules are enabled
   - Check alert evaluation logs
   - Confirm thresholds are properly configured

3. **Missing Correlation IDs**
   - Ensure `CorrelationMiddleware` is properly configured
   - Check `TRACE_REQUESTS=true` setting
   - Verify middleware is applied to all routes

4. **Webhook Alerts Not Working**
   - Verify `ALERT_WEBHOOK_URL` is correct
   - Check webhook authentication token
   - Review webhook endpoint logs

### Debug Commands

```bash
# Check monitoring system status
curl http://localhost:3001/monitoring/status

# Trigger manual alert evaluation
curl -X POST http://localhost:3001/monitoring/alerts/evaluate

# Test alert system
curl -X POST http://localhost:3001/monitoring/alerts/test

# View recent alerts
curl http://localhost:3001/monitoring/alerts/history?limit=10
```

## Best Practices

1. **Correlation ID Usage**
   - Always include correlation IDs in external service calls
   - Use correlation IDs for debugging and tracing
   - Include correlation IDs in error reports

2. **Alert Management**
   - Set appropriate cooldown periods to avoid spam
   - Use severity levels correctly
   - Test alert channels regularly

3. **Metrics Collection**
   - Monitor key business metrics, not just technical ones
   - Use appropriate metric types (counter, gauge, histogram)
   - Include relevant labels for filtering

4. **Log Management**
   - Use structured logging consistently
   - Include relevant context in log messages
   - Avoid logging sensitive information

## Integration with Other Services

The monitoring system integrates with:

- **User Service**: Tracks user-related operations and errors
- **Security Service**: Monitors security events and audit logs
- **Notification Service**: Tracks notification delivery and failures
- **API Gateway**: Provides end-to-end request tracing

All services should use the same correlation ID format for consistent tracing across the platform.