import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Run pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      this.logger.log('Starting database migrations...');
      
      const migrations = await this.dataSource.runMigrations({
        transaction: 'each', // Run each migration in its own transaction
      });

      if (migrations.length === 0) {
        this.logger.log('No pending migrations found');
      } else {
        this.logger.log(`Successfully executed ${migrations.length} migrations:`);
        migrations.forEach(migration => {
          this.logger.log(`  - ${migration.name}`);
        });
      }
    } catch (error) {
      this.logger.error('Migration failed', error);
      throw error;
    }
  }

  /**
   * Revert the last migration
   */
  async revertLastMigration(): Promise<void> {
    try {
      this.logger.log('Reverting last migration...');
      
      await this.dataSource.undoLastMigration({
        transaction: 'each',
      });

      this.logger.log('Successfully reverted last migration');
    } catch (error) {
      this.logger.error('Migration revert failed', error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    executed: any[];
    pending: boolean;
  }> {
    try {
      // Get executed migrations
      const executedMigrations = await this.dataSource.query(`
        SELECT name, timestamp 
        FROM auth_migrations 
        ORDER BY timestamp DESC
      `);

      // Check for pending migrations
      const hasPendingMigrations = await this.dataSource.showMigrations();

      return {
        executed: executedMigrations,
        pending: hasPendingMigrations,
      };
    } catch (error) {
      this.logger.error('Failed to get migration status', error);
      throw error;
    }
  }

  /**
   * Initialize database schema (for development only)
   */
  async synchronizeSchema(): Promise<void> {
    try {
      this.logger.warn('Synchronizing database schema (development only)...');
      
      await this.dataSource.synchronize();
      
      this.logger.log('Schema synchronization completed');
    } catch (error) {
      this.logger.error('Schema synchronization failed', error);
      throw error;
    }
  }

  /**
   * Drop all database tables (for development only)
   */
  async dropSchema(): Promise<void> {
    try {
      this.logger.warn('Dropping database schema...');
      
      await this.dataSource.dropDatabase();
      
      this.logger.log('Schema dropped successfully');
    } catch (error) {
      this.logger.error('Schema drop failed', error);
      throw error;
    }
  }
}