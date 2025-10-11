import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  return {
    type: 'postgres',
    host: configService.get<string>('DATABASE_HOST', 'localhost'),
    port: configService.get<number>('DATABASE_PORT', 5432),
    username: configService.get<string>('DATABASE_USERNAME', 'auth_service'),
    password: configService.get<string>('DATABASE_PASSWORD', 'auth_password'),
    database: configService.get<string>('DATABASE_NAME', 'auth_db'),
    url: configService.get<string>('DATABASE_URL'),
    
    // Connection pooling configuration
    extra: {
      max: configService.get<number>('DATABASE_MAX_CONNECTIONS', 20),
      min: configService.get<number>('DATABASE_MIN_CONNECTIONS', 5),
      acquireTimeoutMillis: configService.get<number>('DATABASE_ACQUIRE_TIMEOUT', 30000),
      idleTimeoutMillis: configService.get<number>('DATABASE_IDLE_TIMEOUT', 30000),
      connectionTimeoutMillis: configService.get<number>('DATABASE_CONNECTION_TIMEOUT', 10000),
    },
    
    // Connection retry configuration
    retryAttempts: configService.get<number>('DATABASE_RETRY_ATTEMPTS', 3),
    retryDelay: configService.get<number>('DATABASE_RETRY_DELAY', 3000),
    
    // Connection timeout
    connectTimeoutMS: configService.get<number>('DATABASE_CONNECT_TIMEOUT', 10000),
    
    // Entity and migration configuration
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    migrationsTableName: 'auth_migrations',
    
    // Development settings
    synchronize: configService.get<string>('NODE_ENV') === 'development',
    logging: configService.get<string>('NODE_ENV') === 'development' ? ['query', 'error'] : ['error'],
    
    // Production settings
    ssl: configService.get<string>('NODE_ENV') === 'production' ? {
      rejectUnauthorized: false,
    } : false,
    
    // Migration settings
    migrationsRun: configService.get<boolean>('RUN_MIGRATIONS', false),
  };
};