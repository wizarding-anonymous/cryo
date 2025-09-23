import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheModuleOptions, CacheOptionsFactory } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

@Injectable()
export class CacheConfig implements CacheOptionsFactory {
  private readonly logger = new Logger(CacheConfig.name);

  constructor(private configService: ConfigService) {}

  createCacheOptions(): CacheModuleOptions {
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = this.configService.get<number>('REDIS_PORT');
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');
    const redisDb = this.configService.get<number>('REDIS_DB', 0);

    // Get environment-specific cache configuration
    const envConfig = this.configService.get('cache', {});
    const defaultTtl =
      envConfig.ttl || this.configService.get<number>('REDIS_TTL', 300);
    const maxItems = envConfig.max || 1000;

    this.logger.log(
      `Configuring Redis cache: ${redisHost}:${redisPort}, DB: ${redisDb}, TTL: ${defaultTtl}s`,
    );

    return {
      store: redisStore as any,
      socket: {
        host: redisHost,
        port: redisPort,
        connectTimeout: 10000,
        lazyConnect: true,
      },
      password: redisPassword || undefined,
      database: redisDb,
      ttl: defaultTtl * 1000, // Convert to milliseconds
      max: maxItems,

      // Connection options
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,

      // Compression (if supported)
      compression: 'gzip',

      // Key prefix for this service
      keyPrefix: 'payment-service:',

      // Error handling
      onClientError: (error: Error) => {
        this.logger.error(`Redis client error: ${error.message}`, error.stack);
      },

      // Connection events
      onConnect: () => {
        this.logger.log('Redis cache connected successfully');
      },

      onDisconnect: () => {
        this.logger.warn('Redis cache disconnected');
      },

      onReconnecting: () => {
        this.logger.log('Redis cache reconnecting...');
      },
    };
  }
}
