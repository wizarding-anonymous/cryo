import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') ||
      `redis://${this.configService.get<string>('REDIS_HOST', 'localhost')}:${this.configService.get<string>('REDIS_PORT', '6379')}`;

    this.client = createClient({ url: redisUrl });

    this.client.on('error', (err) => {
      this.logger.error('Redis Client Error', err);
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    try {
      await this.client.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error.stack);
    }
  }

  async blacklistToken(token: string, ttlSeconds: number): Promise<void> {
    try {
      const key = `blacklist:${token}`;
      await this.client.setEx(key, ttlSeconds, 'true');
    } catch (error) {
      this.logger.error('Failed to blacklist token', error.stack);
      throw error;
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const key = `blacklist:${token}`;
      const result = await this.client.get(key);
      return result === 'true';
    } catch (error) {
      this.logger.error('Failed to check token blacklist', error.stack);
      return false; // Fail open for availability
    }
  }

  async removeFromBlacklist(token: string): Promise<void> {
    try {
      const key = `blacklist:${token}`;
      const result = await this.client.del(key);
      if (result > 0) {
        this.logger.log(`Token removed from Redis blacklist: ${key}`);
      } else {
        this.logger.warn(`Token was not found in Redis blacklist: ${key}`);
      }
    } catch (error) {
      this.logger.error('Failed to remove token from blacklist', error.stack);
      throw error;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      this.logger.error('Failed to set Redis key', error.stack);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error('Failed to get Redis key', error.stack);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error('Failed to delete Redis key', error.stack);
      throw error;
    }
  }

  async setNX(key: string, value: string, ttlSeconds: number): Promise<string | null> {
    try {
      // SET with NX (only set if key doesn't exist) and EX (set expiry in seconds)
      return await this.client.set(key, value, {
        NX: true,
        EX: ttlSeconds
      });
    } catch (error) {
      this.logger.error('Failed to execute SETNX operation', error.stack);
      throw error;
    }
  }

  async getTTL(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error('Failed to get TTL for Redis key', error.stack);
      throw error;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error('Failed to get Redis keys', error.stack);
      throw error;
    }
  }

  async mget(...keys: string[]): Promise<(string | null)[]> {
    try {
      return await this.client.mGet(keys);
    } catch (error) {
      this.logger.error('Failed to execute MGET operation', error.stack);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    } catch (error) {
      this.logger.error('Error closing Redis connection', error.stack);
    }
  }
}