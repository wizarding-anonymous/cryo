import { DataSource } from 'typeorm';
import { Friendship } from '../friends/entities/friendship.entity';
import { Message } from '../messages/entities/message.entity';
import { OnlineStatus } from '../status/entities/online-status.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'postgres',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USERNAME || 'user',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'social_db',
  entities: [Friendship, Message, OnlineStatus],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
  synchronize: false, // Always false for migrations
  logging: process.env.NODE_ENV === 'development',
});