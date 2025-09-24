import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { PrometheusMetricsService } from './prometheus-metrics.service';
import { MonitoringController } from './monitoring.controller';
import { APMService } from './apm.service';
import { PerformanceMonitorService } from './performance-monitor.service';

/**
 * Monitoring module for production readiness
 * Features:
 * - Prometheus metrics
 * - Performance monitoring
 * - Health checks integration
 * - APM integration
 */

@Global()
@Module({
  imports: [
    ConfigModule,
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'library_service_',
        },
      },
    }),
  ],
  providers: [
    PrometheusMetricsService,
    APMService,
    PerformanceMonitorService,
  ],
  controllers: [MonitoringController],
  exports: [
    PrometheusMetricsService,
    APMService,
    PerformanceMonitorService,
  ],
})
export class MonitoringModule {}