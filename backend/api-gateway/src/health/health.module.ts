import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { ServiceRegistryModule } from '../registry/service-registry.module';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [ConfigModule, ServiceRegistryModule],
  controllers: [HealthController, MetricsController],
  providers: [HealthService, MetricsService],
})
export class HealthModule {}
