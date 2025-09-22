import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { Game } from '../entities/game.entity';

@Injectable()
export class DatabaseConfigService implements TypeOrmOptionsFactory {
  private readonly logger = new Logger(DatabaseConfigService.name);

  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const isDevelopment = this.configService.get<string>('NODE_ENV') === 'development';

    const config: TypeOrmModuleOptions = {
      type: 'postgres',
      host: this.configService.get<string>('POSTGRES_HOST', 'localhost'),
      port: this.configService.get<number>('POSTGRES_PORT', 5432),
      username: this.configService.get<string>('POSTGRES_USER', 'user'),
      password: this.configService.get<string>('POSTGRES_PASSWORD', 'password'),
      database: this.configService.get<string>('POSTGRES_DB', 'game_catalog_db'),
      entities: [Game],
      migrations: ['dist/database/migrations/*.js'],
      migrationsTableName: 'migrations',
      synchronize: false, // Always use migrations in production
      logging: isDevelopment ? ['query', 'error', 'warn'] : ['error'],
      logger: isDevelopment ? 'advanced-console' : 'simple-console',
      retryAttempts: 3,
      retryDelay: 3000,
      autoLoadEntities: true,
      // Connection pool settings for better performance
      extra: {
        max: 20, // Maximum number of connections in pool
        min: 5,  // Minimum number of connections in pool
        acquire: 30000, // Maximum time to get connection
        idle: 10000, // Maximum time connection can be idle
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
      },
      // SSL configuration for production
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    };

    this.logger.log(`Database configuration created for ${isDevelopment ? 'development' : 'production'} environment`);
    
    return config;
  }

  /**
   * Validates database connection configuration
   */
  validateConfig(): boolean {
    const requiredVars = ['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB'];
    
    for (const varName of requiredVars) {
      if (!this.configService.get(varName)) {
        this.logger.error(`Missing required environment variable: ${varName}`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Gets database connection info for logging (without sensitive data)
   */
  getConnectionInfo(): string {
    const host = this.configService.get<string>('POSTGRES_HOST');
    const port = this.configService.get<number>('POSTGRES_PORT');
    const database = this.configService.get<string>('POSTGRES_DB');
    
    return `${host}:${port}/${database}`;
  }
}