import { Module } from '@nestjs/common';
import { PrometheusService } from './prometheus.service';
import { MetricsController } from './metrics.controller';
import { AuthMetricsService } from './auth-metrics.service';

@Module({
  providers: [
    PrometheusService,
    AuthMetricsService,
  ],
  controllers: [MetricsController],
  exports: [
    PrometheusService,
    AuthMetricsService,
  ],
})
export class PrometheusModule {}