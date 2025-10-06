import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validates that the database schema is in sync with migrations
   * Note: Migrations should be run manually using npm run migration:run
   */
  async validateSchema(): Promise<boolean> {
    try {
      // Check if migrations table exists
      const migrationsTableExists = await this.dataSource.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `);

      const hasGamesTable = migrationsTableExists.some(
        (table: any) => table.table_name === 'games',
      );
      const hasMigrationsTable = migrationsTableExists.some(
        (table: any) => table.table_name === 'migrations',
      );

      if (!hasGamesTable) {
        this.logger.error(
          'Games table not found. Please run migrations manually using: npm run migration:run',
        );
        return false;
      }

      if (!hasMigrationsTable) {
        this.logger.warn(
          'Migrations table not found. This might indicate migrations were not run through TypeORM CLI.',
        );
        this.logger.warn(
          'Please run migrations manually using: npm run migration:run',
        );
        return false;
      }

      // Check if migrations have been executed
      const executedMigrations = await this.dataSource.query(
        'SELECT COUNT(*) as count FROM migrations',
      );

      if (executedMigrations[0].count === 0) {
        this.logger.warn(
          'No executed migrations found. Please run migrations manually using: npm run migration:run',
        );
        return false;
      }

      this.logger.log('Database schema validation passed');
      return true;
    } catch (error) {
      this.logger.error('Database schema validation failed', error);
      this.logger.error(
        'Please ensure migrations have been run manually using: npm run migration:run',
      );
      return false;
    }
  }

  /**
   * Gets the current migration status
   */
  async getMigrationStatus(): Promise<{
    executed: any[];
    pending: any[];
  }> {
    try {
      const executedMigrations = await this.dataSource.query(
        'SELECT * FROM migrations ORDER BY timestamp ASC',
      );

      // Get pending migrations by comparing with available migration files
      const availableMigrations = this.dataSource.migrations;
      const executedNames = executedMigrations.map((m: any) => m.name);

      const pendingMigrations = availableMigrations.filter(
        (migration) => !executedNames.includes(migration.name),
      );

      return {
        executed: executedMigrations,
        pending: pendingMigrations.map((m) => ({ name: m.name })),
      };
    } catch (error) {
      this.logger.error('Failed to get migration status', error);
      throw error;
    }
  }

  /**
   * Logs migration information for debugging
   */
  async logMigrationInfo(): Promise<void> {
    try {
      const status = await this.getMigrationStatus();

      this.logger.log(`Executed migrations: ${status.executed.length}`);
      this.logger.log(`Pending migrations: ${status.pending.length}`);

      if (status.pending.length > 0) {
        this.logger.warn(
          `Pending migrations: ${status.pending.map((m) => m.name).join(', ')}`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to log migration info', error);
    }
  }
}
