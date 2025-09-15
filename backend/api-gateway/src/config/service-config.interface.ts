export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export interface ServiceConfig {
  name: string;
  baseUrl: string;
  timeout: number;
  retries: number;
  healthCheckPath: string;
  circuitBreaker?: CircuitBreakerConfig;
}

