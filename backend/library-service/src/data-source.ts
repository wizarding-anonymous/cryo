
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { LibraryGame } from './entities/library-game.entity';
import { PurchaseHistory } from './entities/purchase-history.entity';

// Load environment variables
config();

const configService = new ConfigService();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: configService.get('DATABASE_HOST', 'localhost'),
  port: configService.get('DATABASE_PORT', 5432),
  username: configService.get('DATABASE_USERNAME', 'postgres'),
  password: configService.get('DATABASE_PASSWORD', 'password'),
  database: configService.get('DATABASE_NAME', 'library_service'),
  entities: [LibraryGame, PurchaseHistory],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false, // Always false for production safety
  logging:
    configService.get('NODE_ENV') === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  migrationsRun: false, // Migrations should be run manually or via script
  migrationsTableName: 'migrations',
  // Optimized connection pooling configuration
  extra: {
    // Connection pool settings
    max: parseInt(configService.get('DATABASE_MAX_CONNECTIONS', '50'), 10), // Increased for performance testing
    min: parseInt(configService.get('DATABASE_MIN_CONNECTIONS', '10'), 10), // Higher minimum for better performance
    acquireTimeoutMillis: parseInt(
      configService.get('DATABASE_ACQUIRE_TIMEOUT', '30000'),
      10,
    ), // Reduced timeout for faster failure detection
    idleTimeoutMillis: parseInt(
      configService.get('DATABASE_IDLE_TIMEOUT', '300000'),
      10,
    ), // 5 minutes idle timeout
    createTimeoutMillis: parseInt(
      configService.get('DATABASE_CREATE_TIMEOUT', '30000'),
      10,
    ),
    destroyTimeoutMillis: parseInt(
      configService.get('DATABASE_DESTROY_TIMEOUT', '5000'),
      10,
    ),
    reapIntervalMillis: parseInt(
      configService.get('DATABASE_REAP_INTERVAL', '1000'),
      10,
    ),
    createRetryIntervalMillis: parseInt(
      configService.get('DATABASE_CREATE_RETRY_INTERVAL', '200'),
      10,
    ),
    // PostgreSQL specific optimizations
    statement_timeout: parseInt(
      configService.get('DATABASE_STATEMENT_TIMEOUT', '30000'),
      10,
    ), // 30 second query timeout
    query_timeout: parseInt(
      configService.get('DATABASE_QUERY_TIMEOUT', '30000'),
      10,
    ),
    connectionTimeoutMillis: parseInt(
      configService.get('DATABASE_CONNECTION_TIMEOUT', '10000'),
      10,
    ),
    // Performance optimizations
    application_name: 'library-service',
    // Connection validation
    testOnBorrow: true,
    validateOnBorrow: true,
    // SSL configuration for production
    ssl:
      configService.get('NODE_ENV') === 'production'
        ? {
            rejectUnauthorized: false, // Set to true in production with proper certificates
          }
        : false,
  },
  // Query result caching configuration
  cache: {
    type: 'redis',
    options: {
      host: configService.get('REDIS_HOST', 'localhost'),
      port: parseInt(configService.get('REDIS_PORT', '6379'), 10),
      password: configService.get('REDIS_PASSWORD'),
      db: parseInt(configService.get('REDIS_CACHE_DB', '1'), 10), // Use separate DB for query cache
    },
    duration: parseInt(configService.get('QUERY_CACHE_DURATION', '30000'), 10), // 30 seconds default
  },
});
