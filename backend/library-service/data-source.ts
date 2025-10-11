import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * This configuration is used by the TypeORM CLI to generate and run migrations.
 * It reads the database connection details from the .env file.
 * Simplified configuration similar to user-service for better compatibility.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'library_service',
  entities: [
    // Для разработки используем TS файлы, для production - JS
    process.env.NODE_ENV === 'production'
      ? 'dist/src/**/*.entity.js'
      : 'src/**/*.entity.ts'
  ],
  migrations: [
    // Для разработки используем TS файлы, для production - JS
    process.env.NODE_ENV === 'production'
      ? 'dist/src/migrations/*.js'
      : 'src/migrations/*.ts'
  ],
  migrationsTableName: 'migrations',
  synchronize: false, // Never true in production with migrations
  logging: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  // SSL configuration - disabled for Docker containers
  ssl: false,
};

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
