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
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT, 10),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  entities: ['src/**/*.entity.ts'], // Point to TS files for development
  migrations: ['src/database/migrations/*.ts'], // Point to TS files for development
  migrationsTableName: 'migrations',
  synchronize: false, // Migrations will handle the schema
};

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
