import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis.health';
import { CacheHealthIndicator } from './cache.health';
import { AppCacheModule } from '../cache/cache.module';

@Module({
  imports: [TerminusModule, AppCacheModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, CacheHealthIndicator],
})
export class HealthModule {}
