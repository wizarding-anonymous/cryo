import { CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const cacheConfig: CacheModuleAsyncOptions = {
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => {
    const ttl = configService.get<number>('redis.ttl', 300);
    const redisHost = configService.get<string>('redis.host', 'localhost');
    const redisPort = configService.get<number>('redis.port', 6379);
    const redisPassword = configService.get<string | undefined>(
      'redis.password',
    );

    try {
      // Dynamically import redis store
      const { redisStore } = await import('cache-manager-redis-yet');
      const store = await redisStore({
        socket: {
          host: redisHost,
          port: redisPort,
          connectTimeout: 10000,
        },
        password: redisPassword,
        ttl: ttl * 1000, // Convert to milliseconds
      });

      return {
        store,
        ttl: ttl * 1000, // Convert to milliseconds
        max: 1000, // Maximum number of items in cache
        isGlobal: true,
      };
    } catch (error: any) {
      console.warn(
        'Redis store not available, falling back to in-memory cache:',
        error?.message || 'Unknown error',
      );
      // Fallback to in-memory cache
      return {
        ttl: ttl * 1000,
        max: 100, // Smaller limit for in-memory cache
        isGlobal: true,
      };
    }
  },
  inject: [ConfigService],
};
