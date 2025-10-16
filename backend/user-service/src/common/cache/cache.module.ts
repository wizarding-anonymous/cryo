import { Module, forwardRef } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheMetrics } from './cache.metrics';
import { TypeOrmQueryCacheService } from './typeorm-query-cache.service';
import { QueryCacheInterceptor } from './query-cache.interceptor';
import { CacheInvalidationInterceptor } from './cache-invalidation.interceptor';
import { QueryCacheController } from './query-cache.controller';
import { RedisModule } from '../redis/redis.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [RedisModule, forwardRef(() => MetricsModule)],
  providers: [
    CacheService,
    CacheMetrics,
    TypeOrmQueryCacheService,
    QueryCacheInterceptor,
    CacheInvalidationInterceptor,
  ],
  controllers: [QueryCacheController],
  exports: [
    CacheService,
    CacheMetrics,
    TypeOrmQueryCacheService,
    QueryCacheInterceptor,
    CacheInvalidationInterceptor,
  ],
})
export class CacheModule {}
