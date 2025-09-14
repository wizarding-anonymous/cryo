import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables from .env file
dotenv.config();

/**
 * This configuration is used by the TypeORM CLI to generate and run migrations.
 * It reads the database connection details from the .env file.
 * It points to the TypeScript source files for entities and migrations,
 * which is convenient for development workflows.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'library_service',
  entities: [join(__dirname, 'src/**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'src/migrations/*{.ts,.js}')],
  migrationsTableName: 'migrations',
  synchronize: false, // Never true in production with migrations
  logging: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  // Connection pooling configuration
  extra: {
    max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20', 10),
    min: parseInt(process.env.DATABASE_MIN_CONNECTIONS || '5', 10),
    acquireTimeoutMillis: parseInt(process.env.DATABASE_ACQUIRE_TIMEOUT || '60000', 10),
    idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '600000', 10),
  },
};

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
