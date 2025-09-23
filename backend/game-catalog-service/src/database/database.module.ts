import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { DatabaseConfigService } from './database-config.service';
import { RedisConfigService } from './redis-config.service';
import { MigrationService } from './migration.service';

@Module({
  imports: [
    // TypeORM configuration
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useClass: DatabaseConfigService,
    }),
    // Redis cache configuration
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useClass: RedisConfigService,
      isGlobal: true,
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

    // Validate database schema
    try {
      const schemaValid = await this.migrationService.validateSchema();
      if (!schemaValid) {
        this.logger.warn(
          'Database schema validation failed - migrations may be needed',
        );
      }
    } catch (error) {
      this.logger.warn(
        'Could not validate database schema on startup',
        error.message,
      );
    }

    this.logger.log('Database module initialized successfully');
    this.logger.log(
      `Database: ${this.databaseConfigService.getConnectionInfo()}`,
    );
    this.logger.log(`Redis: ${this.redisConfigService.getConnectionInfo()}`);
  }
}
