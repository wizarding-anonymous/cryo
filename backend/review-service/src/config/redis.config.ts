import { CacheModuleOptions } from '@nestjs/cache-manager';

/**
 * Cache configuration for the review service.
 * 
 * Currently using in-memory cache for simplicity and compatibility.
 * For production Redis setup, you can:
 * 
 * 1. Install: npm install cache-manager-ioredis-yet
 * 2. Import: import { redisStore } from 'cache-manager-ioredis-yet';
 * 3. Configure: 
 *    return {
 *      store: redisStore,
 *      host: process.env.REDIS_HOST || 'localhost',
 *      port: parseInt(process.env.REDIS_PORT || '6379', 10),
 *      ttl: 300000, // 5 minutes in milliseconds
 *    };
 */
export const redisConfig = (): CacheModuleOptions => {
  return {
    store: 'memory',
    ttl: 300000, // 5 minutes in milliseconds (same as 300 seconds)
    max: 1000, // Maximum number of items in cache
  };
};