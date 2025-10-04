import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { Game } from '../entities/game.entity';

@Injectable()
export class DatabaseConfigService implements TypeOrmOptionsFactory {
  private readonly logger = new Logger(DatabaseConfigService.name);

  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const isDevelopment =
      this.configService.get<string>('NODE_ENV') === 'development';

    const config: TypeOrmModuleOptions = {
      type: 'postgres',
      host: this.configService.get<string>('POSTGRES_HOST', 'localhost'),
      port: this.configService.get<number>('POSTGRES_PORT', 5432),
      username: this.configService.get<string>('POSTGRES_USER', 'catalog_service'),
      password: this.configService.get<string>('POSTGRES_PASSWORD', 'catalog_password'),
      database: this.configService.get<string>(
        'POSTGRES_DB',
        'catalog_db',
      ),
      entities: [Game],
      migrations: [
        isDevelopment 
          ? 'src/database/migrations/*.ts' 
          : 'dist/src/database/migrations/*.js'
      ],
      migrationsTableName: 'migrations',
      migrationsRun: false, // Never run migrations automatically
      synchronize: false, // Always use migrations
      logging: isDevelopment ? ['error', 'warn'] : ['error'],
      logger: isDevelopment ? 'advanced-console' : 'simple-console',
      retryAttempts: 5,
      retryDelay: 3000,
      autoLoadEntities: true,
      // Connection pool settings for better performance
      extra: {
        max: 10, // Maximum number of connections in pool
        min: 2, // Minimum number of connections in pool
        acquire: 30000, // Maximum time to get connection
        idle: 10000, // Maximum time connection can be idle
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
      },
      // SSL configuration - disabled for Docker containers
      ssl: false,
    };

    this.logger.log(
      `Database configuration created for ${isDevelopment ? 'development' : 'production'} environment`,
    );

    return config;
  }

  /**
   * Validates database connection configuration
   */
  validateConfig(): boolean {
    const requiredVars = [
      'POSTGRES_HOST',
      'POSTGRES_PORT',
      'POSTGRES_USER',
      'POSTGRES_PASSWORD',
      'POSTGRES_DB',
    ];

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
