import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HttpModule } from '@nestjs/axios';
import { AppConfigModule } from '../config/config.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [
    TerminusModule,
    // HttpModule is often used for HttpHealthIndicator if you need to ping external services
    HttpModule,
    // Import AppConfigModule to provide StartupValidationService and AppConfigService
    AppConfigModule,
    // Import RedisModule to provide RedisService for health checks
    RedisModule,
  ],
  controllers: [HealthController],
})
export class HealthModule {}
