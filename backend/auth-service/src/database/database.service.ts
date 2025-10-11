import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Check database connection health
   */
  async checkHealth(): Promise<{ status: string; details: any }> {
    try {
      // Test basic connection
      await this.dataSource.query('SELECT 1');
      
      // Get connection pool stats
      const poolStats = this.getConnectionPoolStats();
      
      return {
        status: 'healthy',
        details: {
          connected: this.dataSource.isInitialized,
          database: this.configService.get('DATABASE_NAME'),
          host: this.configService.get('DATABASE_HOST'),
          port: this.configService.get('DATABASE_PORT'),
          poolStats,
        },
      };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          connected: this.dataSource.isInitialized,
        },
      };
    }
  }

  /**
   * Get connection pool statistics
   */
  private getConnectionPoolStats() {
    try {
      const driver = this.dataSource.driver as any;
      const pool = driver.master || driver.pool;
      
      if (pool && pool.totalCount !== undefined) {
        return {
          totalConnections: pool.totalCount,
          idleConnections: pool.idleCount,
          waitingClients: pool.waitingCount,
          maxConnections: this.configService.get('DATABASE_MAX_CONNECTIONS', 20),
          minConnections: this.configService.get('DATABASE_MIN_CONNECTIONS', 5),
        };
      }
      
      return {
        message: 'Pool statistics not available',
      };
    } catch (error) {
      this.logger.warn('Could not retrieve pool statistics', error.message);
      return {
        error: 'Pool statistics unavailable',
      };
    }
  }

  /**
   * Execute a raw query (for health checks and diagnostics)
   */
  async executeQuery(query: string, parameters?: any[]): Promise<any> {
    try {
      return await this.dataSource.query(query, parameters);
    } catch (error) {
      this.logger.error(`Query execution failed: ${query}`, error);
      throw error;
    }
  }

  /**
   * Get database information
   */
  async getDatabaseInfo(): Promise<any> {
    try {
      const [versionResult, sizeResult] = await Promise.all([
        this.dataSource.query('SELECT version()'),
        this.dataSource.query(`
          SELECT 
            pg_size_pretty(pg_database_size(current_database())) as size,
            current_database() as name
        `),
      ]);

      return {
        version: versionResult[0]?.version,
        database: sizeResult[0]?.name,
        size: sizeResult[0]?.size,
      };
    } catch (error) {
      this.logger.error('Failed to get database info', error);
      throw error;
    }
  }

  /**
   * Check if migrations are up to date
   */
  async checkMigrations(): Promise<{ status: string; details: any }> {
    try {
      // Check if migrations table exists
      const migrationsTable = await this.dataSource.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'auth_migrations'
        );
      `);

      if (!migrationsTable[0]?.exists) {
        return {
          status: 'no_migrations_table',
          details: {
            message: 'Migrations table does not exist. Run migrations to initialize.',
          },
        };
      }

      // Get migration status
      const pendingMigrations = await this.dataSource.showMigrations();
      const executedMigrations = await this.dataSource.query(
        'SELECT * FROM auth_migrations ORDER BY timestamp DESC LIMIT 10'
      );

      return {
        status: pendingMigrations ? 'pending_migrations' : 'up_to_date',
        details: {
          hasPendingMigrations: pendingMigrations,
          lastExecutedMigrations: executedMigrations,
        },
      };
    } catch (error) {
      this.logger.error('Failed to check migrations', error);
      return {
        status: 'error',
        details: {
          error: error.message,
        },
      };
    }
  }
}