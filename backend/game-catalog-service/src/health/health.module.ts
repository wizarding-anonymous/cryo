import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { HealthController, V1HealthController } from './health.controller';
import { MetricsService } from './metrics.service';
import { LoggingService } from './logging.service';
import { HealthMonitoringInterceptor } from './health-monitoring.interceptor';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    DatabaseModule,
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'game_catalog_',
        },
      },
    }),
  ],
  controllers: [HealthController, V1HealthController],
  providers: [MetricsService, LoggingService, HealthMonitoringInterceptor],
  exports: [MetricsService, LoggingService, HealthMonitoringInterceptor],
})
export class HealthModule {}
