import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export class DatabaseConnectionUtil {
  private static readonly logger = new Logger(DatabaseConnectionUtil.name);

  /**
   * Tests database connection
   */
  static async testConnection(dataSource: DataSource): Promise<boolean> {
    try {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      // Test with a simple query
      await dataSource.query('SELECT 1');

      this.logger.log('Database connection test successful');
      return true;
    } catch (error) {
      this.logger.error('Database connection test failed', error);
      return false;
    }
  }

  /**
   * Gracefully closes database connection
   */
  static async closeConnection(dataSource: DataSource): Promise<void> {
    try {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
        this.logger.log('Database connection closed successfully');
      }
    } catch (error) {
      this.logger.error('Error closing database connection', error);
    }
  }

  /**
   * Runs database migrations
   */
  static async runMigrations(dataSource: DataSource): Promise<void> {
    try {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      const migrations = await dataSource.runMigrations();

      if (migrations.length > 0) {
        this.logger.log(`Successfully ran ${migrations.length} migrations`);
        migrations.forEach((migration) => {
          this.logger.log(`- ${migration.name}`);
        });
      } else {
        this.logger.log('No pending migrations found');
      }
    } catch (error) {
      this.logger.error('Failed to run migrations', error);
      throw error;
    }
  }

  /**
   * Reverts the last migration
   */
  static async revertMigration(dataSource: DataSource): Promise<void> {
    try {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      await dataSource.undoLastMigration();
      this.logger.log('Successfully reverted last migration');
    } catch (error) {
      this.logger.error('Failed to revert migration', error);
      throw error;
    }
  }

  /**
   * Gets database connection status
   */
  static getConnectionStatus(dataSource: DataSource): {
    isConnected: boolean;
    hasActiveConnections: boolean;
    connectionCount?: number;
  } {
    const isConnected = dataSource.isInitialized;

    return {
      isConnected,
      hasActiveConnections: isConnected,
    };
  }

  /**
   * Performs database health check
   */
  static async healthCheck(dataSource: DataSource): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
    timestamp: Date;
    responseTime?: number;
  }> {
    const startTime = Date.now();

    try {
      if (!dataSource.isInitialized) {
        return {
          status: 'unhealthy',
          message: 'Database connection not initialized',
          timestamp: new Date(),
        };
      }

      // Test query with timeout
      await Promise.race([
        dataSource.query('SELECT 1'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), 5000),
        ),
      ]);

      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        message: 'Database connection is healthy',
        timestamp: new Date(),
        responseTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database health check failed: ${error.message}`,
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
      };
    }
  }
}
