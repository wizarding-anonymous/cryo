import { Injectable } from '@nestjs/common';
import * as promClient from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly register = new promClient.Registry();

  // HTTP метрики
  private readonly httpRequestsTotal = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.register],
  });

  private readonly httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    registers: [this.register],
  });

  // Интеграционные метрики
  private readonly integrationHealth = new promClient.Gauge({
    name: 'integration_health_status',
    help: 'Health status of external service integrations (1 = healthy, 0 = unhealthy)',
    labelNames: ['service_name'],
    registers: [this.register],
  });

  private readonly integrationResponseTime = new promClient.Histogram({
    name: 'integration_response_time_seconds',
    help: 'Response time of external service integrations in seconds',
    labelNames: ['service_name'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    registers: [this.register],
  });

  // Бизнес метрики
  private readonly userRegistrations = new promClient.Counter({
    name: 'user_registrations_total',
    help: 'Total number of user registrations',
    labelNames: ['source'],
    registers: [this.register],
  });

  private readonly userLogins = new promClient.Counter({
    name: 'user_logins_total',
    help: 'Total number of user logins',
    labelNames: ['method'],
    registers: [this.register],
  });

  private readonly activeUsers = new promClient.Gauge({
    name: 'active_users_current',
    help: 'Current number of active users',
    registers: [this.register],
  });

  private readonly reputationChanges = new promClient.Counter({
    name: 'reputation_changes_total',
    help: 'Total number of reputation changes',
    labelNames: ['source', 'type'],
    registers: [this.register],
  });

  constructor() {
    // Automatically register the default metrics
    promClient.collectDefaultMetrics({ register: this.register });
  }

  getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  // HTTP метрики
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() });
    this.httpRequestDuration.observe({ method, route, status_code: statusCode.toString() }, duration / 1000);
  }

  // Интеграционные метрики
  recordIntegrationHealth(serviceName: string, isHealthy: boolean): void {
    this.integrationHealth.set({ service_name: serviceName }, isHealthy ? 1 : 0);
  }

  recordIntegrationResponseTime(serviceName: string, responseTimeMs: number): void {
    this.integrationResponseTime.observe({ service_name: serviceName }, responseTimeMs / 1000);
  }

  // Бизнес метрики
  recordUserRegistration(source: 'direct' | 'oauth' = 'direct'): void {
    this.userRegistrations.inc({ source });
  }

  recordUserLogin(method: 'password' | 'oauth' | 'mfa' = 'password'): void {
    this.userLogins.inc({ method });
  }

  setActiveUsers(count: number): void {
    this.activeUsers.set(count);
  }

  recordReputationChange(source: string, type: 'positive' | 'negative'): void {
    this.reputationChanges.inc({ source, type });
  }

  // Получение конкретных метрик
  async getHttpRequestsTotal(): Promise<number> {
    const metric = await this.register.getSingleMetric('http_requests_total');
    return metric ? (metric as any).hashMap[''].value : 0;
  }

  async getIntegrationHealthStatus(): Promise<Record<string, number>> {
    const metric = await this.register.getSingleMetric('integration_health_status');
    if (!metric) return {};

    const result: Record<string, number> = {};
    Object.entries((metric as any).hashMap).forEach(([key, value]) => {
      const serviceName = key.split('service_name:')[1]?.replace(/"/g, '');
      if (serviceName) {
        result[serviceName] = (value as any).value;
      }
    });
    return result;
  }
}
