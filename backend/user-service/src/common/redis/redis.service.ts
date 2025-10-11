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
   * Cache user session data
   * @param userId User ID
   * @param sessionData Session data to cache
   * @param ttl Time to live in seconds
   */
  async cacheUserSession(
    userId: string,
    sessionData: any,
    ttl: number = 3600,
  ): Promise<void> {
    try {
      await this.redisClient.setex(
        `session:${userId}`,
        ttl,
        JSON.stringify(sessionData),
      );
      this.logger.debug(`User session cached for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to cache user session: ${error.message}`);
    }
  }

  /**
   * Get cached user session data
   * @param userId User ID
   * @returns Cached session data or null
   */
  async getUserSession(userId: string): Promise<any | null> {
    try {
      const result = await this.redisClient.get(`session:${userId}`);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      this.logger.error(`Failed to get user session: ${error.message}`);
      return null;
    }
  }

  /**
   * Remove user session from cache
   * @param userId User ID
   */
  async removeUserSession(userId: string): Promise<void> {
    try {
      await this.redisClient.del(`session:${userId}`);
      this.logger.debug(`User session removed for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to remove user session: ${error.message}`);
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
