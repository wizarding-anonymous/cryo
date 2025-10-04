import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

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
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'catalog_service',
  password: process.env.POSTGRES_PASSWORD || 'catalog_password',
  database: process.env.POSTGRES_DB || 'catalog_db',
  entities: [
    process.env.NODE_ENV === 'production' 
      ? 'dist/src/entities/*.entity.js' 
      : 'src/entities/*.entity.ts'
  ],
  migrations: [
    process.env.NODE_ENV === 'production' 
      ? 'dist/src/database/migrations/*.js' 
      : 'src/database/migrations/*.ts'
  ],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  migrationsRun: false, // We handle migrations manually
  ssl: false, // Disable SSL for Docker containers
};

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
