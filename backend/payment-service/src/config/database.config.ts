import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { Order } from '../modules/order/entities/order.entity';
import { Payment } from '../modules/payment/entities/payment.entity';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const environment = this.configService.get<string>(
      'NODE_ENV',
      'development',
    );
    const envConfig = this.configService.get('database', {});

    return {
      type: 'postgres',
      host: this.configService.get<string>('POSTGRES_HOST'),
      port: this.configService.get<number>('POSTGRES_PORT'),
      username: this.configService.get<string>('POSTGRES_USERNAME'),
      password: this.configService.get<string>('POSTGRES_PASSWORD'),
      database: this.configService.get<string>('POSTGRES_DATABASE'),

      // SSL Configuration
      ssl:
        envConfig.ssl || this.configService.get<boolean>('POSTGRES_SSL', false)
          ? { rejectUnauthorized: false }
          : false,

      // Connection Pool Configuration
      extra: {
        max:
          envConfig.poolSize ||
          this.configService.get<number>('POSTGRES_POOL_SIZE', 10),
        min: 1,
        connectionTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
      },

      // Entity Configuration
      entities: [Order, Payment],

      // Migration Configuration
      migrations: ['dist/migrations/*.js'],
      migrationsTableName: 'migrations',
      migrationsRun: false, // Run migrations manually

      // Environment-specific Configuration
      synchronize: envConfig.synchronize || false,
      logging:
        envConfig.logging ||
        (environment === 'development' ? ['query', 'error'] : ['error']),

      // Performance Configuration - temporarily disabled
      // cache: {
      //   type: 'redis',
      //   options: {
      //     host: this.configService.get<string>('REDIS_HOST'),
      //     port: this.configService.get<number>('REDIS_PORT'),
      //     password:
      //       this.configService.get<string>('REDIS_PASSWORD') || undefined,
      //     db: this.configService.get<number>('REDIS_DB', 1), // Use different DB for query cache
      //   },
      //   duration: 30000, // 30 seconds cache
      // },

      // Retry Configuration
      retryAttempts: 3,
      retryDelay: 3000,

      // Auto-load entities
      autoLoadEntities: true,

      // Additional Options
      dropSchema: false, // Never drop schema automatically
      keepConnectionAlive: true,
      verboseRetryLog: environment === 'development',
    };
  }
}
