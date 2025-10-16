import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfigService } from '../../config/config.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: Redis;

  constructor(private readonly configService: AppConfigService) {}

  async onModuleInit() {
    const redisConfig = this.configService.redisConfig;

    this.redisClient = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
      maxRetriesPerRequest: redisConfig.maxRetries,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    try {
      await this.redisClient.connect();
      this.logger.log(
        `✅ Redis connected to ${redisConfig.host}:${redisConfig.port}`,
      );
    } catch (error) {
      this.logger.error(`❌ Redis connection failed: ${error.message}`);
      // Don't throw error to prevent service startup failure
      // Redis is used for caching which is not critical for basic functionality
    }
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.logger.log('Redis connection closed');
    }
  }

  /**
   * Generic cache operations for user data
   * @param key Cache key
   * @param data Data to cache
   * @param ttl Time to live in seconds
   */
  async set(key: string, data: any, ttl: number = 300): Promise<void> {
    try {
      await this.redisClient.setex(key, ttl, JSON.stringify(data));
      this.logger.debug(`Data cached with key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to cache data: ${error.message}`);
    }
  }

  /**
   * Get cached data
   * @param key Cache key
   * @returns Cached data or null
   */
  async get(key: string): Promise<any | null> {
    try {
      const result = await this.redisClient.get(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      this.logger.error(`Failed to get cached data: ${error.message}`);
      return null;
    }
  }

  /**
   * Remove data from cache
   * @param key Cache key
   */
  async del(key: string): Promise<void> {
    try {
      await this.redisClient.del(key);
      this.logger.debug(`Data removed from cache with key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to remove cached data: ${error.message}`);
    }
  }

  /**
   * Get Redis client for direct operations (use with caution)
   */
  getClient(): Redis {
    return this.redisClient;
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redisClient.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error(`Redis health check failed: ${error.message}`);
      return false;
    }
  }
}
