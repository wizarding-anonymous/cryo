import { Module, OnModuleInit, Logger, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DatabaseConfigService } from './database-config.service';
import { RedisConfigService } from './redis-config.service';
import { MigrationService } from './migration.service';

@Global()
@Module({
  imports: [
    // TypeORM configuration
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useClass: DatabaseConfigService,
    }),
  ],
  providers: [DatabaseConfigService, RedisConfigService, MigrationService],
  exports: [DatabaseConfigService, RedisConfigService, MigrationService],
})
export class DatabaseModule implements OnModuleInit {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(
    private readonly databaseConfigService: DatabaseConfigService,
    private readonly redisConfigService: RedisConfigService,
    private readonly migrationService: MigrationService,
  ) {}

  async onModuleInit() {
    // Validate configurations on module initialization
    const dbConfigValid = this.databaseConfigService.validateConfig();
    const redisConfigValid = this.redisConfigService.validateConfig();

    if (!dbConfigValid) {
      this.logger.error('Database configuration validation failed');
      throw new Error('Invalid database configuration');
    }

    if (!redisConfigValid) {
      this.logger.warn(
        'Redis configuration validation failed, using memory cache fallback',
      );
    }

    // Validate database schema (non-blocking)
    try {
      const schemaValid = await this.migrationService.validateSchema();
      if (!schemaValid) {
        this.logger.warn(
          'Database schema validation failed - please run migrations manually using: npm run migration:run',
        );
      }
    } catch (error) {
      this.logger.warn(
        'Could not validate database schema on startup. Please ensure migrations have been run manually.',
        (error as Error).message,
      );
    }

    this.logger.log('Database module initialized successfully');
    this.logger.log(
      `Database: ${this.databaseConfigService.getConnectionInfo()}`,
    );
    this.logger.log(`Redis: ${this.redisConfigService.getConnectionInfo()}`);
  }
}
