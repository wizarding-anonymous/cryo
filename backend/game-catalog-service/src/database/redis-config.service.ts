import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisConfigService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisConfigService.name);
  private redisClient: any = null;
  private isRedisAvailable = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeRedis();
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.logger.log('Redis connection closed');
    }
  }

  private async initializeRedis(): Promise<void> {
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');
    const redisDb = this.configService.get<number>('REDIS_DB', 0);

    if (!redisHost) {
      this.logger.warn('⚠️  No Redis host configured, using memory fallback');
      return;
    }

    try {
      const IORedis = (await import('ioredis')).default;
      this.redisClient = new (IORedis as any)({
        host: redisHost,
        port: redisPort,
        password: redisPassword || undefined,
        db: redisDb,
        // Production-ready connection settings
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: false,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
        maxLoadingTimeout: 5000,
        enableReadyCheck: true,
        // Connection pool settings
        family: 4,
        // Reconnection settings
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          return err.message.includes(targetError);
        },
      });

      // Event handlers for production monitoring
      this.redisClient.on('connect', () => {
        this.logger.log(`🔌 Redis connecting to ${redisHost}:${redisPort}`);
      });

      this.redisClient.on('ready', () => {
        this.isRedisAvailable = true;
        this.logger.log(
          `✅ Redis ready at ${redisHost}:${redisPort} (DB: ${redisDb})`,
        );
      });

      this.redisClient.on('error', (error) => {
        this.isRedisAvailable = false;
        this.logger.error(`❌ Redis error: ${error.message}`);
      });

      this.redisClient.on('close', () => {
        this.isRedisAvailable = false;
        this.logger.warn('⚠️  Redis connection closed');
      });

      this.redisClient.on('reconnecting', () => {
        this.logger.log('🔄 Redis reconnecting...');
      });

      // Test connection
      await this.redisClient.ping();
      this.logger.log(`🚀 Production Redis cache initialized: TTL=300s`);
    } catch (error) {
      this.logger.error(
        '❌ Failed to initialize Redis:',
        (error as Error).message,
      );
      this.logger.warn(
        '⚠️  Falling back to memory cache - NOT RECOMMENDED for production',
      );
      this.redisClient = null;
    }
  }

  /**
   * Get Redis client instance
   */
  getClient(): any {
    return this.redisClient;
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.isRedisAvailable && this.redisClient !== null;
  }

  /**
   * Set cache value with TTL
   */
  async set(key: string, value: any, ttlSeconds = 300): Promise<boolean> {
    try {
      if (this.isAvailable() && this.redisClient) {
        const serializedValue = JSON.stringify(value);
        await this.redisClient.setex(key, ttlSeconds, serializedValue);
        return true;
      }
    } catch (error) {
      this.logger.error(
        `Failed to set cache key ${key}:`,
        (error as Error).message,
      );
    }
    return false;
  }

  /**
   * Get cache value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.isAvailable() && this.redisClient) {
        const value = await this.redisClient.get(key);
        return value ? JSON.parse(value) : null;
      }
    } catch (error) {
      this.logger.error(
        `Failed to get cache key ${key}:`,
        (error as Error).message,
      );
    }
    return null;
  }

  /**
   * Delete cache key
   */
  async del(key: string): Promise<boolean> {
    try {
      if (this.isAvailable() && this.redisClient) {
        await this.redisClient.del(key);
        return true;
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete cache key ${key}:`,
        (error as Error).message,
      );
    }
    return false;
  }

  /**
   * Clear all cache keys with pattern
   */
  async clearPattern(pattern: string): Promise<number> {
    try {
      if (this.isAvailable() && this.redisClient) {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
          return keys.length;
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to clear cache pattern ${pattern}:`,
        (error as Error).message,
      );
    }
    return 0;
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
    const status = this.isAvailable() ? 'connected' : 'disconnected';

    return `${host}:${port} (${status})`;
  }

  /**
   * Creates cache key with consistent naming
   */
  createCacheKey(prefix: string, identifier: string): string {
    return `game-catalog:${prefix}:${identifier}`;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    memory: string;
    keys: number;
  }> {
    if (!this.isAvailable() || !this.redisClient) {
      return { connected: false, memory: '0B', keys: 0 };
    }

    try {
      const info = await this.redisClient.info('memory');
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memory = memoryMatch ? memoryMatch[1].trim() : '0B';

      const dbSize = await this.redisClient.dbsize();

      return {
        connected: true,
        memory,
        keys: dbSize,
      };
    } catch (error) {
      this.logger.error('Failed to get Redis stats:', (error as Error).message);
      return { connected: false, memory: '0B', keys: 0 };
    }
  }
}
