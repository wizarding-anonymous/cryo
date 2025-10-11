import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const configService = new ConfigService();

export default new DataSource({
  type: 'postgres',
  host: configService.get<string>('DATABASE_HOST', 'localhost'),
  port: configService.get<number>('DATABASE_PORT', 5432),
  username: configService.get<string>('DATABASE_USERNAME', 'auth_service'),
  password: configService.get<string>('DATABASE_PASSWORD', 'auth_password'),
  database: configService.get<string>('DATABASE_NAME', 'auth_db'),
  url: configService.get<string>('DATABASE_URL'),
  
  // Entity and migration paths
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'auth_migrations',
  
  // Migration settings
  synchronize: false, // Always false for migrations
  logging: ['query', 'error'],
  
  // SSL configuration for production
  ssl: configService.get<string>('NODE_ENV') === 'production' ? {
    rejectUnauthorized: false,
  } : false,
});