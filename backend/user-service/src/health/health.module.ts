import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HttpModule } from '@nestjs/axios';
import { AppConfigModule } from '../config/config.module';
import { RedisModule } from '../common/redis/redis.module';
import { CacheModule } from '../common/cache/cache.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { MetricsModule } from '../common/metrics/metrics.module';

@Module({
  imports: [
    TerminusModule,
    // HttpModule is often used for HttpHealthIndicator if you need to ping external services
    HttpModule,
    // Import AppConfigModule to provide StartupValidationService and AppConfigService
    AppConfigModule,
    // Import RedisModule to provide RedisService for health checks
    RedisModule,
    // Import CacheModule to provide CacheService for health checks
    CacheModule,
    // Import IntegrationsModule to provide external service clients for health checks
    IntegrationsModule,
    // Import MetricsModule to provide MetricsService and SystemMetricsService for health metrics
    MetricsModule,
  ],
  controllers: [HealthController],
})
export class HealthModule {}
