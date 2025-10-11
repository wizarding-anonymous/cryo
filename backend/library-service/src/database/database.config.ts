import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { LibraryGame } from '../entities/library-game.entity';
import { PurchaseHistory } from '../entities/purchase-history.entity';

export const createDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  // Use direct environment variables like user-service does
  const config: TypeOrmModuleOptions = {
    type: 'postgres',
    host: configService.get('DATABASE_HOST'),
    port: configService.get('DATABASE_PORT'),
    username: configService.get('DATABASE_USERNAME'),
    password: configService.get('DATABASE_PASSWORD'),
    database: configService.get('DATABASE_NAME'),
    entities: [LibraryGame, PurchaseHistory],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    migrationsRun: process.env.NODE_ENV === 'production',
    migrationsTableName: 'migrations',
    ssl: false,
    retryAttempts: 3,
    retryDelay: 3000,
    extra: {
      max: configService.get('DATABASE_MAX_CONNECTIONS', 20),
      min: configService.get('DATABASE_MIN_CONNECTIONS', 5),
      acquireTimeoutMillis: configService.get('DATABASE_ACQUIRE_TIMEOUT', 60000),
      idleTimeoutMillis: configService.get('DATABASE_IDLE_TIMEOUT', 600000),
    },
  };

  // Log configuration for debugging
  console.log('Database configuration:', {
    host: config.host,
    port: config.port,
    username: config.username,
    database: config.database,
    ssl: config.ssl,
    synchronize: config.synchronize,
    logging: config.logging,
  });

  return config;
};
