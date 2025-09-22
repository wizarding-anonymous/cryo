import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheModuleOptions, CacheOptionsFactory } from '@nestjs/cache-manager';

@Injectable()
export class RedisConfigService implements CacheOptionsFactory {
  private readonly logger = new Logger(RedisConfigService.name);

  constructor(private configService: ConfigService) {}

  async createCacheOptions(): Promise<CacheModuleOptions> {
    const isDevelopment =
      this.configService.get<string>('NODE_ENV') === 'development';

    try {
      // Dynamic import for Redis store
      const { redisStore } = await import('cache-manager-redis-store');

      const redisConfig = {
        socket: {
          host: this.configService.get<string>('REDIS_HOST', 'localhost'),
          port: this.configService.get<number>('REDIS_PORT', 6379),
          connectTimeout: 5000,
          lazyConnect: true,
        },
        // Redis connection options
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 300,
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
        lazyConnect: true,
      };

      const store = await redisStore(redisConfig);

      const cacheOptions: CacheModuleOptions = {
        store: () => store,
        ttl: 300, // 5 minutes default TTL
        max: 1000, // Maximum number of items in cache
        isGlobal: true,
      };

      this.logger.log(`Redis cache configured for ${this.getConnectionInfo()}`);

      return cacheOptions;
    } catch (error) {
      this.logger.error(
        'Failed to configure Redis cache, falling back to memory cache',
        error,
      );

      // Fallback to memory cache if Redis is not available
      return {
        ttl: 300,
        max: 100, // Smaller cache for memory store
        isGlobal: true,
      };
    }
  }

  /**
   * Validates Redis connection configuration
   */
  validateConfig(): boolean {
    const host = this.configService.get<string>('REDIS_HOST');
    const port = this.configService.get<number>('REDIS_PORT');

    if (!host || !port) {
      this.logger.warn(
        'Redis configuration incomplete, will use memory cache as fallback',
      );
      return false;
    }

    return true;
  }

  /**
   * Gets Redis connection info for logging
   */
  getConnectionInfo(): string {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);

    return `${host}:${port}`;
  }

  /**
   * Creates cache key with consistent naming
   */
  createCacheKey(prefix: string, identifier: string): string {
    return `game-catalog:${prefix}:${identifier}`;
  }
}
