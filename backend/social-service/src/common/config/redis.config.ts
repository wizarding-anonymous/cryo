import { CacheModuleOptions } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';

export const getRedisConfig = (configService: ConfigService): CacheModuleOptions => ({
  store: redisStore as any,
  host: configService.get('REDIS_HOST', 'localhost'),
  port: configService.get<number>('REDIS_PORT', 6379),
  password: configService.get('REDIS_PASSWORD'),
  ttl: 300, // 5 minutes default TTL
  max: 1000, // Maximum number of items in cache
  // Redis-specific options
  db: 0, // Redis database number
  keyPrefix: 'social-service:', // Prefix for all cache keys
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
});
