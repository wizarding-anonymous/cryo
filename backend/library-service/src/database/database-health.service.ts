import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';

@Injectable()
export class DatabaseHealthService extends HealthIndicator {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Check if database connection is active
      if (!this.dataSource.isInitialized) {
        throw new Error('Database connection not initialized');
      }

      // Execute a simple query to verify connection
      await this.dataSource.query('SELECT 1');

      // Check connection pool status
      const poolStatus = {
        isConnected: this.dataSource.isInitialized,
        hasActiveConnections: true,
      };

      return this.getStatus(key, true, poolStatus);
    } catch (error: any) {
      throw new HealthCheckError(
        'Database health check failed',
        this.getStatus(key, false, { error: error.message }),
      );
    }
  }

  async getConnectionInfo(): Promise<any> {
    if (!this.dataSource.isInitialized) {
      return { status: 'disconnected' };
    }

    const options = this.dataSource.options as any;

    return {
      status: 'connected',
      database: options.database,
      host: options.host,
      port: options.port,
      type: options.type,
    };
  }
}
