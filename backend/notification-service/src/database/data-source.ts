import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Notification, NotificationSettings } from '../entities';

const configService = new ConfigService();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: configService.get('DATABASE_HOST', 'localhost'),
  port: configService.get('DATABASE_PORT', 5433),
  username: configService.get('DATABASE_USERNAME', 'notification_user'),
  password: configService.get('DATABASE_PASSWORD', 'notification_password'),
  database: configService.get('DATABASE_NAME', 'notification_db'),
  entities: [Notification, NotificationSettings],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: configService.get('NODE_ENV') === 'development',
  logging: configService.get('NODE_ENV') === 'development',
});