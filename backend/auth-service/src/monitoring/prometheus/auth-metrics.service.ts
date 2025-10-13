import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, register } from 'prom-client';

@Injectable()
export class AuthMetricsService {
  // Authentication operation counters
  private readonly authOperationsTotal = new Counter({
    name: 'auth_operations_total',
    help: 'Total number of authentication operations',
    labelNames: ['operation', 'status', 'method'],
    registers: [register],
  });

  // Authentication operation duration
  private readonly authOperationDuration = new Histogram({
    name: 'auth_operation_duration_seconds',
    help: 'Duration of authentication operations in seconds',
    labelNames: ['operation', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [register],
  });

  // Active sessions gauge
  private readonly activeSessions = new Gauge({
    name: 'auth_active_sessions_total',
    help: 'Number of active user sessions',
    registers: [register],
  });

  // Token operations
  private readonly tokenOperationsTotal = new Counter({
    name: 'auth_token_operations_total',
    help: 'Total number of token operations',
    labelNames: ['operation', 'status'],
    registers: [register],
  });

  // Blacklisted tokens
  private readonly blacklistedTokensTotal = new Gauge({
    name: 'auth_blacklisted_tokens_total',
    help: 'Number of blacklisted tokens',
    registers: [register],
  });

  // Authentication failures
  private readonly authFailuresTotal = new Counter({
    name: 'auth_failures_total',
    help: 'Total number of authentication failures',
    labelNames: ['reason', 'endpoint'],
    registers: [register],
  });

  // Rate limiting
  private readonly rateLimitHitsTotal = new Counter({
    name: 'auth_rate_limit_hits_total',
    help: 'Total number of rate limit hits',
    labelNames: ['endpoint', 'ip'],
    registers: [register],
  });

  // External service calls
  private readonly externalServiceCallsTotal = new Counter({
    name: 'auth_external_service_calls_total',
    help: 'Total number of external service calls',
    labelNames: ['service', 'operation', 'status'],
    registers: [register],
  });

  private readonly externalServiceCallDuration = new Histogram({
    name: 'auth_external_service_call_duration_seconds',
    help: 'Duration of external service calls in seconds',
    labelNames: ['service', 'operation'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    registers: [register],
  });

  // Circuit breaker metrics
  private readonly circuitBreakerState = new Gauge({
    name: 'auth_circuit_breaker_state',
    help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
    labelNames: ['service'],
    registers: [register],
  });

  // Redis operations
  private readonly redisOperationsTotal = new Counter({
    name: 'auth_redis_operations_total',
    help: 'Total number of Redis operations',
    labelNames: ['operation', 'status'],
    registers: [register],
  });

  // Database operations
  private readonly dbOperationsTotal = new Counter({
    name: 'auth_db_operations_total',
    help: 'Total number of database operations',
    labelNames: ['operation', 'entity', 'status'],
    registers: [register],
  });

  private readonly dbOperationDuration = new Histogram({
    name: 'auth_db_operation_duration_seconds',
    help: 'Duration of database operations in seconds',
    labelNames: ['operation', 'entity'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [register],
  });

  // Authentication operation metrics
  incrementAuthOperation(operation: string, status: 'success' | 'failure', method?: string): void {
    this.authOperationsTotal.inc({ operation, status, method: method || 'unknown' });
  }

  recordAuthOperationDuration(operation: string, status: 'success' | 'failure', duration: number): void {
    this.authOperationDuration.observe({ operation, status }, duration);
  }

  // Session metrics
  setActiveSessions(count: number): void {
    this.activeSessions.set(count);
  }

  incrementActiveSessions(): void {
    this.activeSessions.inc();
  }

  decrementActiveSessions(): void {
    this.activeSessions.dec();
  }

  // Token metrics
  incrementTokenOperation(operation: string, status: 'success' | 'failure'): void {
    this.tokenOperationsTotal.inc({ operation, status });
  }

  setBlacklistedTokens(count: number): void {
    this.blacklistedTokensTotal.set(count);
  }

  incrementBlacklistedTokens(): void {
    this.blacklistedTokensTotal.inc();
  }

  // Failure metrics
  incrementAuthFailure(reason: string, endpoint: string): void {
    this.authFailuresTotal.inc({ reason, endpoint });
  }

  // Rate limiting metrics
  incrementRateLimitHit(endpoint: string, ip: string): void {
    this.rateLimitHitsTotal.inc({ endpoint, ip });
  }

  // External service metrics
  incrementExternalServiceCall(service: string, operation: string, status: 'success' | 'failure'): void {
    this.externalServiceCallsTotal.inc({ service, operation, status });
  }

  recordExternalServiceCallDuration(service: string, operation: string, duration: number): void {
    this.externalServiceCallDuration.observe({ service, operation }, duration);
  }

  // Circuit breaker metrics
  setCircuitBreakerState(service: string, state: 'closed' | 'open' | 'half-open'): void {
    const stateValue = state === 'closed' ? 0 : state === 'open' ? 1 : 2;
    this.circuitBreakerState.set({ service }, stateValue);
  }

  // Redis metrics
  incrementRedisOperation(operation: string, status: 'success' | 'failure'): void {
    this.redisOperationsTotal.inc({ operation, status });
  }

  // Database metrics
  incrementDbOperation(operation: string, entity: string, status: 'success' | 'failure'): void {
    this.dbOperationsTotal.inc({ operation, entity, status });
  }

  recordDbOperationDuration(operation: string, entity: string, duration: number): void {
    this.dbOperationDuration.observe({ operation, entity }, duration);
  }

  // Utility method to get all current metric values
  async getCurrentMetrics(): Promise<any> {
    const metrics = await register.metrics();
    return {
      raw: metrics,
      timestamp: new Date().toISOString(),
    };
  }
}