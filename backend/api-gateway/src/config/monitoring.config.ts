import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  register,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
} from 'prom-client';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  // Metrics
  public readonly httpRequestsTotal: Counter<string>;
  public readonly httpRequestDuration: Histogram<string>;
  public readonly activeConnections: Gauge<string>;
  public readonly upstreamServiceHealth: Gauge<string>;

  constructor(private readonly configService: ConfigService) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    if (isProduction) {
      // Collect default Node.js metrics
      collectDefaultMetrics({
        register,
        prefix: 'api_gateway_',
        gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
      });
    }

    // HTTP request metrics
    this.httpRequestsTotal = new Counter({
      name: 'api_gateway_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'service'],
      registers: [register],
    });

    this.httpRequestDuration = new Histogram({
      name: 'api_gateway_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'service'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [register],
    });

    // Connection metrics
    this.activeConnections = new Gauge({
      name: 'api_gateway_active_connections',
      help: 'Number of active connections',
      registers: [register],
    });

    // Upstream service health
    this.upstreamServiceHealth = new Gauge({
      name: 'api_gateway_upstream_service_health',
      help: 'Health status of upstream services (1 = healthy, 0 = unhealthy)',
      labelNames: ['service'],
      registers: [register],
    });

    this.logger.log('Monitoring service initialized');
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    service?: string,
  ): void {
    const labels = {
      method,
      route,
      status_code: statusCode.toString(),
      service: service || 'gateway',
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, duration);
  }

  updateActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  updateServiceHealth(serviceName: string, isHealthy: boolean): void {
    this.upstreamServiceHealth.set({ service: serviceName }, isHealthy ? 1 : 0);
  }

  getMetrics(): Promise<string> {
    return register.metrics();
  }

  clearMetrics(): void {
    register.clear();
  }
}
