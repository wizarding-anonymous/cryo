import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { RedisModule } from '../common/redis/redis.module';
import { DatabaseModule } from '../database/database.module';
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';
import { CacheModule } from '../common/cache/cache.module';
import { MetricsModule } from '../common/metrics/metrics.module';
import { UserCacheService } from '../common/cache/user-cache.service';

@Module({
  imports: [TerminusModule, HttpModule, RedisModule, DatabaseModule, CircuitBreakerModule, CacheModule, MetricsModule],
  providers: [UserCacheService],
  controllers: [HealthController],
})
export class HealthModule {}