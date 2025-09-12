import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * This configuration is used for local development when running outside Docker.
 * It uses localhost instead of Docker service names.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'user_service',
  password: 'password123',
  database: 'user_service_db',
  entities: ['src/**/*.entity.ts'], // Point to TS files for development
  migrations: ['src/database/migrations/*.ts'], // Point to TS files for development
  migrationsTableName: 'migrations',
  synchronize: false, // Migrations will handle the schema
};

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;