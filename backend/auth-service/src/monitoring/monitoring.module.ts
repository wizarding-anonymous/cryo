import { Module } from '@nestjs/common';
import { PrometheusModule } from './prometheus/prometheus.module';
import { LoggingModule } from './logging/logging.module';
import { AlertingModule } from './alerting/alerting.module';
import { MonitoringController } from './monitoring.controller';
import { CorrelationMiddleware } from './middleware/correlation.middleware';

@Module({
  imports: [
    PrometheusModule,
    LoggingModule,
    AlertingModule,
  ],
  controllers: [MonitoringController],
  providers: [CorrelationMiddleware],
  exports: [
    PrometheusModule,
    LoggingModule,
    AlertingModule,
    CorrelationMiddleware,
  ],
})
export class MonitoringModule {}