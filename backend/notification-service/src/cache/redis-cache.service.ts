import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client!: RedisClient;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL');
      const redisHost = this.configService.get<string>(
        'REDIS_HOST',
        'localhost',
      );
      const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
      const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

      let clientConfig: Parameters<typeof createClient>[0];

      if (redisUrl) {
        clientConfig = { url: redisUrl };
      } else {
        clientConfig = {
          socket: {
            host: redisHost,
            port: redisPort,
          },
        };

        if (redisPassword) {
          clientConfig.password = redisPassword;
        }
      }

      this.client = createClient(clientConfig);

      this.client.on('error', (err) => {
        this.logger.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.logger.log('Redis Client Connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        this.logger.log('Redis Client Ready');
      });

      this.client.on('end', () => {
        this.logger.log('Redis Client Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      this.isConnected = false;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
        this.logger.log('Redis connection closed');
      } catch (error) {
        this.logger.error('Error closing Redis connection:', error);
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, returning null for key:', key);
      return null;
    }

    try {
      const value = await this.client.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      this.logger.error(`Error getting key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, cannot set key:', key);
      return false;
    }

    try {
      const serializedValue = JSON.stringify(value);

      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }

      return true;
    } catch (error) {
      this.logger.error(`Error setting key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, cannot delete key:', key);
      return false;
    }

    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      this.logger.error(`Error deleting key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      this.logger.error(`Error checking existence of key ${key}:`, error);
      return false;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected) {
      return [];
    }

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error(`Error getting keys with pattern ${pattern}:`, error);
      return [];
    }
  }

  async flushAll(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.client.flushAll();
      return true;
    } catch (error) {
      this.logger.error('Error flushing all keys:', error);
      return false;
    }
  }

  isRedisConnected(): boolean {
    return this.isConnected;
  }
}
