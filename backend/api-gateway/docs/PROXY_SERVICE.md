# ProxyService Documentation

## Overview

The ProxyService is the core component responsible for routing HTTP requests from the API Gateway to the appropriate microservices. It provides advanced features like retry logic, circuit breaker pattern, and comprehensive error handling.

## Features

- **Service Resolution**: Automatically routes requests to the correct microservice based on URL patterns
- **HTTP Client**: Uses Axios with connection pooling for optimal performance
- **Retry Logic**: Implements exponential backoff for failed requests
- **Circuit Breaker**: Protects against cascade failures with configurable thresholds
- **Error Handling**: Graceful handling of timeouts, network errors, and service failures
- **Logging**: Comprehensive logging for monitoring and debugging
- **Monitoring**: Built-in methods for circuit breaker statistics and admin operations

## Service Resolution

The ProxyService automatically maps API routes to microservices:

| Route Pattern | Target Service | Example |
|---------------|----------------|---------|
| `/api/auth/*` | user-service | `/api/auth/login` |
| `/api/users/*` | user-service | `/api/users/profile` |
| `/api/games/*` | game-catalog-service | `/api/games/popular` |
| `/api/payments/*` | payment-service | `/api/payments/create` |
| `/api/library/*` | library-service | `/api/library/games` |
| `/api/social/*` | social-service | `/api/social/friends` |
| `/api/reviews/*` | review-service | `/api/reviews/game/123` |
| `/api/achievements/*` | achievement-service | `/api/achievements/user/456` |
| `/api/notifications/*` | notification-service | `/api/notifications/unread` |
| `/api/downloads/*` | download-service | `/api/downloads/game/789` |
| `/api/security/*` | security-service | `/api/security/scan` |

## Configuration

Service configurations are managed by the ServiceRegistryService and include:

```typescript
interface ServiceConfig {
  name: string;
  baseUrl: string;
  timeout: number;
  retries: number;
  healthCheckPath: string;
  circuitBreaker: {
    failureThreshold: number;
    resetTimeout: number;
    monitoringPeriod: number;
  };
}
```

### Default Configuration

```typescript
const defaultConfig = {
  timeout: 5000,           // 5 seconds
  retries: 2,              // 2 retry attempts
  circuitBreaker: {
    failureThreshold: 5,   // Open after 5 failures
    resetTimeout: 30000,   // 30 seconds before half-open
    monitoringPeriod: 60000 // 1 minute monitoring window
  }
};
```

## Retry Logic

The service implements exponential backoff with the following behavior:

- **Retriable Errors**: Network errors and 5xx HTTP status codes
- **Non-Retriable Errors**: 4xx HTTP status codes (client errors)
- **Backoff Formula**: `100ms * 2^(attempt-1)`
- **Example Delays**: 100ms, 200ms, 400ms, 800ms...

```typescript
// Example retry sequence for 3 attempts
// Attempt 1: Immediate
// Attempt 2: Wait 100ms
// Attempt 3: Wait 200ms
// Attempt 4: Wait 400ms (if configured)
```

## Circuit Breaker

The circuit breaker protects against cascade failures with three states:

### States

1. **Closed**: Normal operation, requests pass through
2. **Open**: Circuit is open, requests are blocked
3. **Half-Open**: Testing if service has recovered

### State Transitions

```
Closed --[failures >= threshold]--> Open
Open --[reset timeout elapsed]--> Half-Open
Half-Open --[success]--> Closed
Half-Open --[failure]--> Open
```

### Configuration

- **Failure Threshold**: Number of failures before opening circuit
- **Reset Timeout**: Time to wait before trying half-open state
- **Monitoring Period**: Time window for counting failures

## Error Handling

### Timeout Handling

```typescript
// Throws ProxyTimeoutException
if (error.code === 'ECONNABORTED') {
  throw new ProxyTimeoutException(serviceName, timeout);
}
```

### Service Unavailable

```typescript
// Throws ServiceUnavailableException
if (!serviceConfig) {
  throw new ServiceUnavailableException(serviceName, 'Service not configured');
}
```

### Error Response Forwarding

When upstream services return error responses, they are forwarded with original status codes and headers:

```typescript
return {
  statusCode: error.response.status,
  headers: processedHeaders,
  body: error.response.data
};
```

## Header Processing

### Forwarded Headers

The service processes and forwards appropriate headers:

- **Filtered Out**: Connection-specific headers (connection, keep-alive, etc.)
- **Added**: Proxy headers (x-forwarded-for, x-forwarded-host, x-forwarded-proto)
- **Preserved**: Application headers (authorization, content-type, etc.)

### Hop-by-Hop Headers (Filtered)

- connection
- keep-alive
- proxy-authenticate
- proxy-authorization
- te
- trailer
- transfer-encoding
- upgrade
- host
- content-length

## Monitoring and Administration

### Circuit Breaker Statistics

```typescript
const stats = proxyService.getCircuitBreakerStats();
// Returns: Record<serviceName, CircuitState & { serviceName: string }>
```

### Admin Operations

```typescript
// Reset specific service circuit breaker
proxyService.resetCircuitBreaker('user-service');

// Reset all circuit breakers
proxyService.resetAllCircuitBreakers();
```

## Usage Examples

### Basic Request Forwarding

```typescript
@Injectable()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All('/api/*')
  async forwardRequest(@Req() req: Request) {
    return await this.proxyService.forward(req);
  }
}
```

### Custom Error Handling

```typescript
try {
  const result = await this.proxyService.forward(req);
  return result;
} catch (error) {
  if (error instanceof ProxyTimeoutException) {
    // Handle timeout
  } else if (error instanceof ServiceUnavailableException) {
    // Handle service unavailable
  }
  throw error;
}
```

## Performance Considerations

### Connection Pooling

The service uses persistent HTTP agents with connection pooling:

```typescript
private readonly httpAgent = new http.Agent({ 
  keepAlive: true, 
  maxSockets: 200,
  timeout: 60000,
});
```

### Memory Usage

- Circuit breaker states are stored in memory
- States automatically expire based on monitoring period
- Memory usage scales with number of unique services

### Latency

- **Overhead**: ~1-5ms for request processing
- **Network**: Depends on target service response time
- **Retries**: Additional latency for failed requests

## Logging

The service provides comprehensive logging at different levels:

### Debug Level

- Request forwarding details
- Retry attempts and delays
- Circuit breaker state changes

### Warn Level

- Request failures and timeouts
- Circuit breaker openings
- Service unavailable events

### Log Level

- Circuit breaker recovery
- Admin operations (resets)

## Testing

### Unit Tests

```bash
npm test -- --testPathPatterns=proxy.service.spec.ts
```

### Integration Tests

```bash
npm run test:e2e
```

### Load Testing

```bash
# Example with Artillery
artillery run perf/proxy-load-test.yml
```

## Troubleshooting

### Common Issues

1. **High Latency**
   - Check target service response times
   - Review retry configuration
   - Monitor circuit breaker states

2. **Circuit Breaker Always Open**
   - Verify service health
   - Check failure threshold configuration
   - Review service configuration

3. **Request Timeouts**
   - Increase timeout configuration
   - Check network connectivity
   - Monitor service performance

### Debug Commands

```bash
# Enable debug logging
DEBUG=proxy-service npm start

# Check circuit breaker stats
curl http://localhost:3000/admin/circuit-breakers

# Reset circuit breakers
curl -X POST http://localhost:3000/admin/circuit-breakers/reset
```

## Security Considerations

- Headers are properly filtered to prevent header injection
- Circuit breaker prevents DoS amplification
- Timeout configuration prevents resource exhaustion
- Error responses don't leak internal service details

## Future Enhancements

- Load balancing between service instances
- Request/response transformation
- Caching layer integration
- Metrics collection and export
- Dynamic service discovery
- Request routing based on content