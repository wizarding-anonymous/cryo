import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DatabaseConnectionUtil } from './database-connection.util';

@Injectable()
export class DatabaseHealthService extends HealthIndicator {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    super();
  }

  /**
   * Performs database health check
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const healthResult = await DatabaseConnectionUtil.healthCheck(
        this.dataSource,
      );

      if (healthResult.status === 'healthy') {
        return this.getStatus(key, true, {
          message: healthResult.message,
          responseTime: healthResult.responseTime,
          timestamp: healthResult.timestamp,
        });
      } else {
        throw new HealthCheckError(
          'Database health check failed',
          this.getStatus(key, false, {
            message: healthResult.message,
            timestamp: healthResult.timestamp,
          }),
        );
      }
    } catch (error) {
      throw new HealthCheckError(
        'Database health check failed',
        this.getStatus(key, false, {
          message: (error as Error).message,
          timestamp: new Date(),
        }),
      );
    }
  }

  /**
   * Performs Redis health check
   */
  async isRedisHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const ioredis = await import('ioredis');
      const Redis = ioredis.default;
      const redisHost = process.env.REDIS_HOST || 'redis';
      const redisPort = parseInt(process.env.REDIS_PORT || '6379');
      const redisPassword = process.env.REDIS_PASSWORD;

      const redis = new (Redis as any)({
        host: redisHost,
        port: redisPort,
        password: redisPassword || undefined,
        connectTimeout: 5000,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });

      const startTime = Date.now();
      await redis.ping();
      const responseTime = Date.now() - startTime;

      redis.disconnect();

      return this.getStatus(key, true, {
        message: 'Redis connection is healthy',
        responseTime,
        timestamp: new Date(),
      });
    } catch (error) {
      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, {
          message: (error as Error).message,
          timestamp: new Date(),
        }),
      );
    }
  }

  /**
   * Gets detailed database connection status
   */
  async getConnectionStatus(): Promise<{
    database: any;
    redis: any;
  }> {
    const dbStatus = DatabaseConnectionUtil.getConnectionStatus(
      this.dataSource,
    );

    let redisStatus = {
      status: 'unknown',
      message: 'Redis status check failed',
      host: process.env.REDIS_HOST || 'redis',
      port: process.env.REDIS_PORT || '6379',
    };

    try {
      const ioredis = await import('ioredis');
      const Redis = ioredis.default;
      const redis = new (Redis as any)({
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        connectTimeout: 3000,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });

      await redis.ping();
      const info = await redis.info('server');
      const versionMatch = info.match(/redis_version:([^\r\n]+)/);

      redisStatus = {
        status: 'connected',
        message: 'Redis connection is healthy',
        host: process.env.REDIS_HOST || 'redis',
        port: process.env.REDIS_PORT || '6379',
        ...(versionMatch && { version: versionMatch[1] }),
      };

      redis.disconnect();
    } catch (error) {
      redisStatus.message = `Redis connection failed: ${(error as Error).message}`;
    }

    return {
      database: {
        isConnected: dbStatus.isConnected,
        hasActiveConnections: dbStatus.hasActiveConnections,
        driver: this.dataSource.driver.constructor.name,
        database: this.dataSource.options.database,
        host: (this.dataSource.options as any).host,
        port: (this.dataSource.options as any).port,
      },
      redis: redisStatus,
    };
  }
}
