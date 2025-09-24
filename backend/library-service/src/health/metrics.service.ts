import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge, Histogram, register } from 'prom-client';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('library_service_health_checks_total')
    private readonly healthChecksCounter: Counter<string>,

    @InjectMetric('library_service_external_service_status')
    private readonly externalServiceStatusGauge: Gauge<string>,

    @InjectMetric('library_service_external_service_response_time')
    private readonly externalServiceResponseTimeHistogram: Histogram<string>,

    @InjectMetric('library_service_database_connections')
    private readonly databaseConnectionsGauge: Gauge<string>,

    @InjectMetric('library_service_cache_operations_total')
    private readonly cacheOperationsCounter: Counter<string>,

    @InjectMetric('library_service_circuit_breaker_state')
    private readonly circuitBreakerStateGauge: Gauge<string>,
  ) {}

  recordHealthCheck(component: string, status: 'success' | 'failure'): void {
    this.healthChecksCounter.inc({ component, status });
  }

  setExternalServiceStatus(service: string, status: 0 | 1): void {
    this.externalServiceStatusGauge.set({ service }, status);
  }

  recordExternalServiceResponseTime(
    service: string,
    responseTime: number,
  ): void {
    this.externalServiceResponseTimeHistogram.observe(
      { service },
      responseTime / 1000,
    ); // Convert to seconds
  }

  setDatabaseConnections(active: number, idle: number): void {
    this.databaseConnectionsGauge.set({ type: 'active' }, active);
    this.databaseConnectionsGauge.set({ type: 'idle' }, idle);
  }

  recordCacheOperation(
    operation: string,
    status: 'hit' | 'miss' | 'error',
  ): void {
    this.cacheOperationsCounter.inc({ operation, status });
  }

  setCircuitBreakerState(
    service: string,
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN',
  ): void {
    const stateValue = state === 'CLOSED' ? 0 : state === 'HALF_OPEN' ? 1 : 2;
    this.circuitBreakerStateGauge.set({ service }, stateValue);
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}
