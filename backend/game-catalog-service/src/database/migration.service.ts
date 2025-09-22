import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DatabaseConnectionUtil } from './database-connection.util';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Runs all pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      await DatabaseConnectionUtil.runMigrations(this.dataSource);
    } catch (error) {
      this.logger.error('Migration execution failed', error);
      throw error;
    }
  }

  /**
   * Reverts the last migration
   */
  async revertLastMigration(): Promise<void> {
    try {
      await DatabaseConnectionUtil.revertMigration(this.dataSource);
    } catch (error) {
      this.logger.error('Migration revert failed', error);
      throw error;
    }
  }

  /**
   * Gets migration status
   */
  async getMigrationStatus(): Promise<{
    executedMigrations: string[];
    pendingMigrations: string[];
  }> {
    try {
      const executedMigrations = await this.dataSource.query(
        'SELECT * FROM migrations ORDER BY timestamp DESC'
      );
      
      // Get all migration files
      const allMigrations = this.dataSource.migrations.map(m => m.name);
      const executedNames = executedMigrations.map(m => m.name);
      const pendingMigrations = allMigrations.filter(name => !executedNames.includes(name));

      return {
        executedMigrations: executedNames,
        pendingMigrations,
      };
    } catch (error) {
      this.logger.error('Failed to get migration status', error);
      throw error;
    }
  }

  /**
   * Validates database schema
   */
  async validateSchema(): Promise<boolean> {
    try {
      // Check if required tables exist
      const tables = await this.dataSource.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `);

      const tableNames = tables.map(t => t.table_name);
      const requiredTables = ['games', 'migrations'];

      const missingTables = requiredTables.filter(table => !tableNames.includes(table));

      if (missingTables.length > 0) {
        this.logger.error(`Missing required tables: ${missingTables.join(', ')}`);
        return false;
      }

      this.logger.log('Database schema validation passed');
      return true;
    } catch (error) {
      this.logger.error('Schema validation failed', error);
      return false;
    }
  }

  /**
   * Seeds the database with initial data
   */
  async seedDatabase(): Promise<void> {
    try {
      // Check if games table has data
      const gameCount = await this.dataSource.query('SELECT COUNT(*) FROM games');
      
      if (parseInt(gameCount[0].count) > 0) {
        this.logger.log('Database already contains data, skipping seed');
        return;
      }

      this.logger.log('Seeding database with initial data...');
      
      // The seed data is already included in the migration
      // This method can be extended for additional seeding if needed
      
      this.logger.log('Database seeding completed');
    } catch (error) {
      this.logger.error('Database seeding failed', error);
      throw error;
    }
  }
}