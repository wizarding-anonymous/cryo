import { registerAs } from '@nestjs/config';
import { CacheModuleOptions } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

export default registerAs(
  'redis',
  (): CacheModuleOptions => ({
    store: redisStore as any,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    ttl: 300, // 5 minutes default TTL
    max: 1000, // Maximum number of items in cache
  }),
);