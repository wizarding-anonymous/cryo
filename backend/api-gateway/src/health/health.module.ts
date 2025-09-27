import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { ProductionReadinessService } from './production-readiness.service';
import { EnvironmentValidatorService } from '../config/environment-validator.service';
import { ServiceRegistryModule } from '../registry/service-registry.module';
import { RedisModule } from '../redis/redis.module';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [ConfigModule, ServiceRegistryModule, RedisModule],
  controllers: [HealthController, MetricsController],
  providers: [
    HealthService,
    MetricsService,
    ProductionReadinessService,
    EnvironmentValidatorService,
  ],
})
export class HealthModule {}
