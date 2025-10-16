# ELK Stack Integration Guide

## Overview

This document describes how the User Service integrates with the ELK Stack (Elasticsearch, Logstash, Kibana) for centralized logging and monitoring.

## Architecture

```
User Service → Logstash → Elasticsearch → Kibana
```

### Components

1. **User Service**: Generates structured logs using Winston
2. **Logstash**: Processes and forwards logs to Elasticsearch
3. **Elasticsearch**: Stores and indexes log data
4. **Kibana**: Provides visualization and search interface

## Log Structure

All logs follow a consistent structure for ELK compatibility:

```json
{
  "@timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "message": "User operation completed successfully",
  "service": "user-service",
  "version": "1.0.0",
  "environment": "production",
  "correlationId": "abc123-def456-ghi789",
  "userId": "user-uuid-here",
  "operation": "user_create",
  "duration": 150,
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "requestId": "req-uuid-here",
  "metadata": {
    "email": "user@example.com",
    "success": true
  },
  "host": "user-service-pod-1",
  "pid": 1234,
  "container": "user-service"
}
```

## Configuration

### Environment Variables

```bash
# Logstash Configuration
LOGSTASH_HOST=logstash
LOGSTASH_HTTP_PORT=8080
ENABLE_ELK_LOGGING=true

# Log Level Configuration
LOG_LEVEL=info
LOG_FORMAT=json

# Service Information
SERVICE_VERSION=1.0.0
HOSTNAME=user-service-pod-1
CONTAINER_NAME=user-service
```

### Winston Configuration

The Winston logger is configured to send logs to Logstash via HTTP transport:

```typescript
new transports.Http({
  host: process.env.LOGSTASH_HOST || 'logstash',
  port: parseInt(process.env.LOGSTASH_HTTP_PORT || '8080'),
  path: '/logs',
  format: elkFormat,
  level: 'info',
})
```

## Log Types

### 1. Application Logs

Standard application events and operations:

- User CRUD operations
- Cache operations
- Database operations
- External service calls

### 2. Audit Logs

Compliance and security-focused logs:

- Data access events
- User authentication events
- Administrative actions
- Sensitive data access

### 3. Security Logs

Security-related events:

- Failed authentication attempts
- Unauthorized access attempts
- Rate limiting events
- Suspicious activities

### 4. Performance Logs

Performance and monitoring data:

- Request/response times
- Database query performance
- Cache hit/miss ratios
- System resource usage

## Kibana Dashboards

### User Service Overview Dashboard

Key metrics and visualizations:

1. **Request Volume**: Total requests over time
2. **Response Times**: Average, P95, P99 response times
3. **Error Rates**: Error percentage by endpoint
4. **Cache Performance**: Hit/miss ratios
5. **Database Performance**: Query times and counts

### Security Dashboard

Security-focused visualizations:

1. **Authentication Events**: Login attempts, failures, successes
2. **Access Patterns**: User access by IP, location, time
3. **Suspicious Activities**: Failed attempts, rate limiting
4. **Data Access**: Sensitive data access patterns

### Audit Dashboard

Compliance and audit visualizations:

1. **Data Operations**: CRUD operations by user/time
2. **Administrative Actions**: Admin operations tracking
3. **User Activities**: User behavior patterns
4. **Compliance Reports**: Regulatory compliance metrics

## Index Patterns

### Primary Index

- **Pattern**: `microservices-logs-*`
- **Time Field**: `@timestamp`
- **Refresh**: Every 30 seconds

### Audit Index

- **Pattern**: `audit-logs-*`
- **Time Field**: `@timestamp`
- **Retention**: 7 years (compliance requirement)

## Alerting

### Critical Alerts

1. **High Error Rate**: >5% error rate for 5 minutes
2. **Service Down**: No logs received for 2 minutes
3. **Database Issues**: Database errors >10/minute
4. **Security Incidents**: Multiple failed auth attempts

### Warning Alerts

1. **Slow Responses**: P95 response time >2 seconds
2. **Cache Issues**: Cache hit rate <80%
3. **High Load**: Request rate >1000/minute

## Log Retention

- **Application Logs**: 30 days
- **Audit Logs**: 7 years
- **Security Logs**: 1 year
- **Performance Logs**: 90 days

## Troubleshooting

### Common Issues

1. **Logs Not Appearing in Kibana**
   - Check Logstash connectivity
   - Verify HTTP transport configuration
   - Check Elasticsearch cluster health

2. **Missing Correlation IDs**
   - Ensure LoggingInterceptor is properly configured
   - Check request header propagation

3. **Performance Impact**
   - Monitor HTTP transport latency
   - Consider async logging for high-volume scenarios
   - Adjust log levels in production

### Debug Commands

```bash
# Check Logstash connectivity
curl -X POST http://logstash:8080/logs \
  -H "Content-Type: application/json" \
  -d '{"test": "message"}'

# Check Elasticsearch indices
curl http://elasticsearch:9200/_cat/indices?v

# Check Kibana health
curl http://kibana:5601/api/status
```

## Best Practices

### 1. Structured Logging

- Always use structured JSON format
- Include correlation IDs in all logs
- Sanitize sensitive data before logging

### 2. Log Levels

- **ERROR**: System errors, exceptions
- **WARN**: Recoverable issues, degraded performance
- **INFO**: Important business events, user actions
- **DEBUG**: Detailed diagnostic information

### 3. Performance

- Use async logging for high-volume scenarios
- Batch log entries when possible
- Monitor logging overhead

### 4. Security

- Never log passwords or sensitive data
- Use correlation IDs for request tracing
- Log all security-relevant events

### 5. Compliance

- Ensure audit logs are immutable
- Implement proper retention policies
- Include all required compliance fields

## Monitoring

### Key Metrics to Monitor

1. **Log Volume**: Logs per second/minute
2. **Log Latency**: Time from generation to indexing
3. **Error Rates**: Application and infrastructure errors
4. **Storage Usage**: Elasticsearch disk usage
5. **Query Performance**: Kibana query response times

### Health Checks

```typescript
// Check ELK connectivity
async checkELKHealth(): Promise<boolean> {
  try {
    // Test Logstash connectivity
    await axios.post(`http://${LOGSTASH_HOST}:${LOGSTASH_PORT}/logs`, {
      test: 'health-check',
      timestamp: new Date().toISOString()
    });
    return true;
  } catch (error) {
    return false;
  }
}
```

## Migration Guide

### From Console Logging

1. Replace `console.log` with structured logging
2. Add correlation ID tracking
3. Implement proper log levels
4. Add metadata for context

### From File-based Logging

1. Configure HTTP transport to Logstash
2. Update log format to JSON
3. Remove file-based transports (optional)
4. Update log rotation policies

## Examples

### Basic Logging

```typescript
this.loggingService.info('User created successfully', {
  correlationId: 'abc-123',
  operation: 'user_create',
  metadata: {
    userId: 'user-123',
    email: 'user@example.com'
  }
});
```

### Audit Logging

```typescript
this.auditService.logDataAccess({
  operation: 'READ',
  table: 'users',
  recordId: 'user-123',
  userId: 'admin-456',
  correlationId: 'abc-123',
  ipAddress: '192.168.1.100',
  userAgent: 'Mozilla/5.0...',
  success: true
});
```

### Security Logging

```typescript
this.loggingService.logSecurityEvent(
  'Failed login attempt',
  'user-123',
  'abc-123',
  '192.168.1.100',
  'Mozilla/5.0...',
  'medium',
  { attempts: 3, reason: 'invalid_password' }
);
```