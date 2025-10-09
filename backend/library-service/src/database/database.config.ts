import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { LibraryGame } from '../entities/library-game.entity';
import { PurchaseHistory } from '../entities/purchase-history.entity';

export const createDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('database.host'),
  port: configService.get('database.port'),
  username: configService.get('database.username'),
  password: configService.get('database.password'),
  database: configService.get('database.database'),
  entities: [LibraryGame, PurchaseHistory],
  synchronize: configService.get('database.synchronize'),
  logging: configService.get('database.logging'),
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  migrationsRun: process.env.NODE_ENV === 'production',
  migrationsTableName: 'migrations',
  // Enhanced connection pooling configuration
  extra: {
    // Connection pool settings
    max: configService.get('database.maxConnections'), // Maximum number of connections
    min: configService.get('database.minConnections'), // Minimum number of connections
    acquireTimeoutMillis: configService.get('database.acquireTimeout'), // Time to wait for connection
    idleTimeoutMillis: configService.get('database.idleTimeout'), // Time before idle connection is closed

    // Query optimization settings
    statement_timeout: configService.get('database.statementTimeout') || 30000, // 30 seconds
    query_timeout: configService.get('database.queryTimeout') || 25000, // 25 seconds

    // Connection settings for better performance
    application_name: 'library-service',

    // PostgreSQL specific optimizations
    // options: '-c default_transaction_isolation=read_committed', // Using default

    // Connection validation
    testOnBorrow: true,
    validationQuery: 'SELECT 1',

    // Additional pool settings
    evictionRunIntervalMillis: 60000, // Run eviction every minute
    numTestsPerEvictionRun: 3,
    softIdleTimeoutMillis:
      configService.get('database.softIdleTimeout') || 300000, // 5 minutes

    // SSL configuration disabled for Docker containers
    // SSL is not needed for local Docker PostgreSQL instances
  },

  // Query result caching for better performance
  cache: {
    type: 'redis',
    options: {
      host: configService.get('redis.host'),
      port: configService.get('redis.port'),
      password: configService.get('redis.password'),
    },
    duration: configService.get('database.cacheTimeout') || 30000, // 30 seconds default
  },

  // SSL configuration - disabled for Docker containers
  ssl: false,
  
  // Connection retry configuration
  retryAttempts: configService.get('database.retryAttempts') || 3,
  retryDelay: configService.get('database.retryDelay') || 3000,

  // Enable query optimization features
  maxQueryExecutionTime:
    configService.get('database.maxQueryExecutionTime') || 10000, // 10 seconds
});
