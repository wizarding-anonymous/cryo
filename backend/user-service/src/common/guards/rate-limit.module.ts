import { Module } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import { RedisModule } from '../redis/redis.module';
import { AppConfigModule } from '../../config/config.module';

/**
 * Модуль для rate limiting с поддержкой Redis
 */
@Module({
  imports: [RedisModule, AppConfigModule],
  providers: [RateLimitGuard],
  exports: [RateLimitGuard],
})
export class RateLimitModule {}