import { Module } from '@nestjs/common';
import { RedisModule } from './redis/redis.module';
import { CacheModule } from './cache/cache.module';
import { LoggingModule } from './logging/logging.module';
import { InternalServiceGuard } from './guards';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

@Module({
  imports: [RedisModule, CacheModule, LoggingModule],
  providers: [InternalServiceGuard, LoggingInterceptor],
  exports: [
    RedisModule,
    CacheModule,
    LoggingModule,
    InternalServiceGuard,
    LoggingInterceptor,
  ],
})
export class CommonModule {}
