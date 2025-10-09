import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis.health';
import { CacheHealthIndicator } from './cache.health';
import { ExternalServicesHealthIndicator } from './external-services.health';
import { ProductionHealthService } from './production-health.service';
import { MetricsService } from './metrics.service';
import { AppCacheModule } from '../cache/cache.module';
import { DatabaseModule } from '../database/database.module';
import { ClientsModule } from '../clients/clients.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { SecretsManagerService } from '../common/services/secrets-manager.service';

import { metricsProviders } from './metrics.config';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    AppCacheModule,
    DatabaseModule,
    ClientsModule,
    MonitoringModule,
  ],
  controllers: [HealthController],
  providers: [
    RedisHealthIndicator,
    CacheHealthIndicator,
    ExternalServicesHealthIndicator,
    ProductionHealthService,
    MetricsService,
    SecretsManagerService,
    ...metricsProviders,
  ],
  exports: [MetricsService, ProductionHealthService],
})
export class HealthModule {}
