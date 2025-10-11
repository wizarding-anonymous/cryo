import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { MigrationService } from './migration.service';

@Injectable()
export class DatabaseCliService {
  private readonly logger = new Logger(DatabaseCliService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly migrationService: MigrationService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Initialize database (create tables, run migrations)
   */
  async initializeDatabase(): Promise<void> {
    try {
      this.logger.log('Initializing Auth Service database...');

      // Check database connection
      const healthCheck = await this.databaseService.checkHealth();
      if (healthCheck.status !== 'healthy') {
        throw new Error(`Database connection failed: ${JSON.stringify(healthCheck.details)}`);
      }

      this.logger.log('Database connection verified');

      // Run migrations
      await this.migrationService.runMigrations();

      // Verify migration status
      const migrationStatus = await this.migrationService.getMigrationStatus();
      this.logger.log(`Migration status: ${migrationStatus.pending ? 'Pending migrations exist' : 'Up to date'}`);

      this.logger.log('Database initialization completed successfully');
    } catch (error) {
      this.logger.error('Database initialization failed', error);
      throw error;
    }
  }

  /**
   * Reset database (drop and recreate)
   */
  async resetDatabase(): Promise<void> {
    const nodeEnv = this.configService.get('NODE_ENV');
    
    if (nodeEnv === 'production') {
      throw new Error('Database reset is not allowed in production environment');
    }

    try {
      this.logger.warn('Resetting database (development only)...');

      // Drop schema
      await this.migrationService.dropSchema();
      
      // Run migrations to recreate
      await this.migrationService.runMigrations();

      this.logger.log('Database reset completed');
    } catch (error) {
      this.logger.error('Database reset failed', error);
      throw error;
    }
  }

  /**
   * Show database status
   */
  async showStatus(): Promise<void> {
    try {
      this.logger.log('=== Auth Service Database Status ===');

      // Database health
      const healthCheck = await this.databaseService.checkHealth();
      this.logger.log(`Connection Status: ${healthCheck.status}`);
      
      if (healthCheck.details.poolStats) {
        const stats = healthCheck.details.poolStats;
        this.logger.log(`Connection Pool: ${stats.totalConnections}/${stats.maxConnections} (${stats.idleConnections} idle, ${stats.waitingClients} waiting)`);
      }

      // Database info
      try {
        const dbInfo = await this.databaseService.getDatabaseInfo();
        this.logger.log(`Database: ${dbInfo.database} (${dbInfo.size})`);
        this.logger.log(`PostgreSQL Version: ${dbInfo.version?.split(' ')[0] || 'Unknown'}`);
      } catch (error) {
        this.logger.warn('Could not retrieve database info');
      }

      // Migration status
      const migrationStatus = await this.databaseService.checkMigrations();
      this.logger.log(`Migration Status: ${migrationStatus.status}`);
      
      if (migrationStatus.details.lastExecutedMigrations?.length > 0) {
        this.logger.log('Recent Migrations:');
        migrationStatus.details.lastExecutedMigrations.slice(0, 5).forEach((migration: any) => {
          this.logger.log(`  - ${migration.name} (${new Date(migration.timestamp).toISOString()})`);
        });
      }

      this.logger.log('=== End Database Status ===');
    } catch (error) {
      this.logger.error('Failed to show database status', error);
      throw error;
    }
  }

  /**
   * Test database performance
   */
  async testPerformance(): Promise<void> {
    try {
      this.logger.log('Running database performance test...');

      const startTime = Date.now();
      
      // Test basic query performance
      await this.databaseService.executeQuery('SELECT 1');
      const basicQueryTime = Date.now() - startTime;

      // Test connection pool
      const poolTestStart = Date.now();
      const promises = Array.from({ length: 10 }, () => 
        this.databaseService.executeQuery('SELECT pg_sleep(0.1)')
      );
      await Promise.all(promises);
      const poolTestTime = Date.now() - poolTestStart;

      this.logger.log(`Basic Query Time: ${basicQueryTime}ms`);
      this.logger.log(`Pool Test (10 concurrent): ${poolTestTime}ms`);

      // Get current connections
      const connections = await this.databaseService.executeQuery(`
        SELECT count(*) as active_connections 
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);

      this.logger.log(`Active Connections: ${connections[0]?.active_connections || 'Unknown'}`);
      this.logger.log('Performance test completed');
    } catch (error) {
      this.logger.error('Performance test failed', error);
      throw error;
    }
  }
}