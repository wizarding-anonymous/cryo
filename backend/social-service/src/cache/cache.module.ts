import { Module } from '@nestjs/common';
import {
  CacheModule,
  CacheModuleOptions,
  CacheStoreFactory,
} from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { CacheService } from './cache.service';

const isMemoryStore =
  (process.env.CACHE_STORE || '').toLowerCase() === 'memory' ||
  process.env.NODE_ENV === 'test' ||
  process.env.NODE_ENV === 'development';

const cacheOptions: CacheModuleOptions = {
  isGlobal: true,
  ttl: 900,
  max: 1000,
};

if (!isMemoryStore) {
  Object.assign(cacheOptions, {
    store: redisStore as unknown as CacheStoreFactory,
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  });
}

@Module({
  imports: [CacheModule.register(cacheOptions)],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheConfigModule {}
