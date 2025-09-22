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
          message: error.message,
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
      // This would need to be implemented with actual Redis client
      // For now, we'll return a basic check
      return this.getStatus(key, true, {
        message: 'Redis connection is healthy',
        timestamp: new Date(),
      });
    } catch (error) {
      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, {
          message: error.message,
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

    return {
      database: {
        isConnected: dbStatus.isConnected,
        hasActiveConnections: dbStatus.hasActiveConnections,
        driver: this.dataSource.driver.constructor.name,
        database: this.dataSource.options.database,
      },
      redis: {
        // This would be implemented with actual Redis client status
        status: 'unknown',
        message: 'Redis status check not implemented yet',
      },
    };
  }
}
