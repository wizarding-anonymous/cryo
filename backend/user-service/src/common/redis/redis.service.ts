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
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 30000, // Увеличиваем таймаут подключения до 30 секунд
      commandTimeout: 15000, // Увеличиваем таймаут команд до 15 секунд
      enableReadyCheck: true,
      family: 4,
      keepAlive: 30000,
      enableOfflineQueue: false,
      // Добавляем дополнительные настройки для стабильности
      autoResubscribe: false,
      autoResendUnfulfilledCommands: false,
      // Настройки для обработки сетевых проблем
      showFriendlyErrorStack: true,
    });

    // Add error handlers to prevent unhandled errors
    this.redisClient.on('error', (error) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis connection error: ${errorMessage}`);
    });

    this.redisClient.on('connect', () => {
      this.logger.log(
        `✅ Redis connected to ${redisConfig.host}:${redisConfig.port}`,
      );
    });

    this.redisClient.on('ready', () => {
      this.logger.log('✅ Redis ready for operations');
    });

    this.redisClient.on('close', () => {
      this.logger.warn('⚠️ Redis connection closed');
    });

    this.redisClient.on('reconnecting', (delay: number) => {
      this.logger.log(`🔄 Redis reconnecting in ${delay}ms...`);
    });

    this.redisClient.on('end', () => {
      this.logger.warn('⚠️ Redis connection ended');
    });

    // Попытка подключения с улучшенной логикой повторов
    await this.connectWithRetry();
  }

  private async connectWithRetry(): Promise<void> {
    const maxRetries = 3;
    const baseDelay = 5000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Проверяем статус перед подключением
        const currentStatus = this.redisClient.status;

        if (currentStatus === 'ready') {
          this.logger.log('✅ Redis already connected');
          return;
        }

        if (currentStatus === 'connecting') {
          this.logger.log('⏳ Redis connection in progress, waiting...');
          // Ждем завершения текущего подключения
          await new Promise((resolve) => setTimeout(resolve, 3000));

          if (this.redisClient.status === 'ready') {
            this.logger.log('✅ Redis connection completed');
            return;
          }
        }

        this.logger.log(
          `Attempting Redis connection (${attempt}/${maxRetries})...`,
        );

        // Добавляем задержку только для повторных попыток
        if (attempt > 1) {
          const delay = baseDelay + (attempt - 1) * 2000;
          this.logger.log(`Waiting ${delay}ms before attempt ${attempt}...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // Подключаемся только если не подключены
        if (
          this.redisClient.status !== 'connecting' &&
          this.redisClient.status !== 'ready'
        ) {
          await Promise.race([
            this.redisClient.connect(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Connection timeout')), 15000),
            ),
          ]);
        }

        this.logger.log('✅ Redis connection established successfully');
        return;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Игнорируем ошибки "already connecting"
        if (
          errorMessage.includes('already connecting') ||
          errorMessage.includes('already connected')
        ) {
          this.logger.log(
            'Redis connection already in progress or established',
          );
          return;
        }

        this.logger.warn(
          `Redis connection attempt ${attempt}/${maxRetries} failed: ${errorMessage}`,
        );

        if (attempt === maxRetries) {
          this.logger.error(
            `❌ Redis connection failed after ${maxRetries} attempts. Running in fallback mode.`,
          );
          return;
        }
      }
    }
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
        this.logger.log('Redis connection closed');
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(`Error closing Redis connection: ${errorMessage}`);
      }
    }
  }

  /**
   * Generic cache operations for user data
   * @param key Cache key
   * @param data Data to cache
   * @param ttl Time to live in seconds
   */
  async set(key: string, data: unknown, ttl: number = 300): Promise<void> {
    try {
      if (!this.isConnected()) {
        this.logger.debug('Redis not connected, skipping cache set');
        return;
      }
      await this.redisClient.setex(key, ttl, JSON.stringify(data));
      this.logger.debug(`Data cached with key: ${key}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to cache data: ${errorMessage}`);
    }
  }

  /**
   * Get cached data
   * @param key Cache key
   * @returns Cached data or null
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected()) {
        this.logger.debug('Redis not connected, returning null');
        return null;
      }
      const result = await this.redisClient.get(key);
      return result ? (JSON.parse(result) as T) : null;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get cached data: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Remove data from cache
   * @param key Cache key
   */
  async del(key: string): Promise<void> {
    try {
      if (!this.isConnected()) {
        this.logger.debug('Redis not connected, skipping cache delete');
        return;
      }
      await this.redisClient.del(key);
      this.logger.debug(`Data removed from cache with key: ${key}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to remove cached data: ${errorMessage}`);
    }
  }

  /**
   * Check if Redis is connected and ready
   */
  private isConnected(): boolean {
    return this.redisClient && this.redisClient.status === 'ready';
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
      if (!this.redisClient) {
        this.logger.warn('Redis client not initialized');
        return false;
      }

      const status = this.redisClient.status;
      if (status !== 'ready') {
        this.logger.warn(
          `Redis client not ready for health check (status: ${status})`,
        );

        // Попытаемся переподключиться если статус не ready
        if (status === 'close' || status === 'end') {
          this.logger.log('Attempting to reconnect Redis...');
          try {
            await this.connectWithRetry();
            if (this.redisClient.status === 'ready') {
              return true;
            }
          } catch (reconnectError: unknown) {
            const reconnectErrorMessage =
              reconnectError instanceof Error
                ? reconnectError.message
                : String(reconnectError);
            this.logger.warn(
              `Redis reconnection failed: ${reconnectErrorMessage}`,
            );
          }
        }
        return false;
      }

      const result = await Promise.race([
        this.redisClient.ping(),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 3000),
        ),
      ]);

      const isHealthy = result === 'PONG';
      if (isHealthy) {
        this.logger.debug('✅ Redis health check passed');
      }
      return isHealthy;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis health check failed: ${errorMessage}`);

      // Попытаемся переподключиться при ошибке health check
      try {
        this.logger.log(
          'Attempting Redis reconnection after health check failure...',
        );
        await this.connectWithRetry();
        return this.redisClient.status === 'ready';
      } catch (reconnectError: unknown) {
        const reconnectErrorMessage =
          reconnectError instanceof Error
            ? reconnectError.message
            : String(reconnectError);
        this.logger.warn(
          `Redis reconnection after health check failed: ${reconnectErrorMessage}`,
        );
        return false;
      }
    }
  }
}
