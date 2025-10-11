# Circuit Breaker Configuration

This module provides circuit breaker functionality for the Auth Service to handle external service failures gracefully.

## Overview

The circuit breaker pattern prevents cascading failures by monitoring external service calls and temporarily stopping requests when a service is failing. This helps maintain system stability and provides fallback mechanisms.

## Components

### CircuitBreakerConfig
Provides configuration for different circuit breakers based on environment variables.

### CircuitBreakerService
Creates and manages circuit breakers with monitoring and logging capabilities.

### BaseCircuitBreakerClient
Base class for HTTP clients that need circuit breaker protection.

## Configuration

Circuit breaker behavior is controlled through environment variables:

### Default Configuration
```bash
CIRCUIT_BREAKER_TIMEOUT=3000                    # Request timeout in ms
CIRCUIT_BREAKER_ERROR_THRESHOLD=50              # Error percentage to open circuit
CIRCUIT_BREAKER_RESET_TIMEOUT=30000             # Time before trying to close circuit
CIRCUIT_BREAKER_ROLLING_TIMEOUT=10000           # Rolling window duration
CIRCUIT_BREAKER_ROLLING_BUCKETS=10              # Number of buckets in rolling window
CIRCUIT_BREAKER_VOLUME_THRESHOLD=10             # Minimum requests before opening
```

### Service-Specific Configuration
Each service can have its own circuit breaker settings:

```bash
# User Service
USER_SERVICE_CIRCUIT_BREAKER_TIMEOUT=3000
USER_SERVICE_CIRCUIT_BREAKER_ERROR_THRESHOLD=50
USER_SERVICE_CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# Security Service
SECURITY_SERVICE_CIRCUIT_BREAKER_TIMEOUT=5000
SECURITY_SERVICE_CIRCUIT_BREAKER_ERROR_THRESHOLD=60
SECURITY_SERVICE_CIRCUIT_BREAKER_RESET_TIMEOUT=60000
SECURITY_SERVICE_CIRCUIT_BREAKER_VOLUME_THRESHOLD=5

# Notification Service
NOTIFICATION_SERVICE_CIRCUIT_BREAKER_TIMEOUT=5000
NOTIFICATION_SERVICE_CIRCUIT_BREAKER_ERROR_THRESHOLD=70
NOTIFICATION_SERVICE_CIRCUIT_BREAKER_RESET_TIMEOUT=60000
NOTIFICATION_SERVICE_CIRCUIT_BREAKER_VOLUME_THRESHOLD=3
```

## Usage

### Creating a Circuit Breaker Client

```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BaseCircuitBreakerClient } from '../common/circuit-breaker';
import { CircuitBreakerService, CircuitBreakerConfig } from '../common/circuit-breaker';

@Injectable()
export class MyServiceClient extends BaseCircuitBreakerClient {
  constructor(
    httpService: HttpService,
    configService: ConfigService,
    circuitBreakerService: CircuitBreakerService,
    circuitBreakerConfig: CircuitBreakerConfig,
  ) {
    super(
      httpService,
      configService,
      circuitBreakerService,
      'MyService',                                    // Service name
      'MY_SERVICE_URL',                               // URL config key
      'http://localhost:3000',                        // Default URL
      circuitBreakerConfig.getMyServiceConfig(),      // Circuit breaker config
    );
  }

  async getData(id: string): Promise<any> {
    try {
      return await this.get(`/data/${id}`);
    } catch (error) {
      if (error instanceof ServiceUnavailableError) {
        // Handle circuit breaker open state
        return this.getFallbackData(id);
      }
      throw error;
    }
  }

  private getFallbackData(id: string): any {
    // Provide fallback data when service is unavailable
    return { id, status: 'unavailable' };
  }
}
```

### Manual Circuit Breaker Creation

```typescript
import { Injectable } from '@nestjs/common';
import { CircuitBreakerService } from '../common/circuit-breaker';

@Injectable()
export class MyService {
  constructor(private circuitBreakerService: CircuitBreakerService) {}

  async initializeCircuitBreaker() {
    const circuitBreaker = this.circuitBreakerService.createCircuitBreaker(
      this.externalServiceCall.bind(this),
      {
        timeout: 3000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        volumeThreshold: 10,
        name: 'ExternalService',
      }
    );

    // Use the circuit breaker
    try {
      const result = await circuitBreaker.fire('param1', 'param2');
      return result;
    } catch (error) {
      // Handle circuit breaker errors
      console.error('Circuit breaker error:', error);
      throw error;
    }
  }

  private async externalServiceCall(param1: string, param2: string): Promise<any> {
    // Your external service call logic here
    return { param1, param2 };
  }
}
```

## Monitoring

### Health Check Endpoints

Circuit breaker status can be monitored through health check endpoints:

- `GET /api/health/circuit-breakers` - Get all circuit breaker statistics
- `GET /api/health/circuit-breakers/:name` - Get specific circuit breaker statistics

### Circuit Breaker States

- **CLOSED**: Normal operation, requests are allowed through
- **OPEN**: Circuit is open, requests are rejected immediately
- **HALF_OPEN**: Testing if the service has recovered

### Events and Logging

The circuit breaker service automatically logs the following events:

- Circuit breaker state changes (open, close, half-open)
- Request successes and failures
- Timeouts and rejections
- Fallback executions

## Best Practices

1. **Configure appropriate timeouts**: Set timeouts based on expected service response times
2. **Set reasonable error thresholds**: Don't set thresholds too low to avoid false positives
3. **Implement fallback mechanisms**: Always provide fallback behavior when services are unavailable
4. **Monitor circuit breaker metrics**: Use the health endpoints to monitor circuit breaker behavior
5. **Test circuit breaker behavior**: Ensure your fallback mechanisms work correctly
6. **Use service-specific configurations**: Different services may need different circuit breaker settings

## Error Handling

When a circuit breaker is open, requests will throw a `ServiceUnavailableError`. Always handle this error and provide appropriate fallback behavior:

```typescript
try {
  const result = await this.serviceClient.getData(id);
  return result;
} catch (error) {
  if (error instanceof ServiceUnavailableError) {
    // Service is unavailable, use fallback
    return this.getFallbackData(id);
  }
  // Handle other errors
  throw error;
}
```

## Testing

Circuit breaker functionality can be tested by:

1. Running unit tests for configuration and service creation
2. Integration tests that simulate service failures
3. Manual testing by stopping external services
4. Load testing to verify circuit breaker behavior under stress

Example test:

```typescript
describe('Circuit Breaker Integration', () => {
  it('should open circuit breaker after threshold failures', async () => {
    // Simulate multiple failures
    for (let i = 0; i < 10; i++) {
      try {
        await serviceClient.getData('test');
      } catch (error) {
        // Expected failures
      }
    }

    // Circuit breaker should now be open
    expect(serviceClient.isCircuitBreakerOpen()).toBe(true);
  });
});
```