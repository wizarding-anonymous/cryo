import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables from .env.docker.local file
dotenv.config({ path: '.env.docker.local' });

/**
 * This configuration is used to connect to Docker containers from the host machine.
 * It reads from .env.docker.local to connect to the Docker PostgreSQL container.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT, 10) || 5433,
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