import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Notification, NotificationSettings } from '../entities';

const configService = new ConfigService();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: configService.get('DB_HOST', 'localhost'),
  port: configService.get('DB_PORT', 5432),
  username: configService.get('DB_USERNAME', 'notification_user'),
  password: configService.get('DB_PASSWORD', 'notification_password'),
  database: configService.get('DB_DATABASE', 'notification_db'),
  entities: [Notification, NotificationSettings],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: configService.get('NODE_ENV') === 'development',
  logging: configService.get('NODE_ENV') === 'development',
});
