import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { Friendship } from './src/friends/entities/friendship.entity';
import { Message } from './src/messages/entities/message.entity';
import { OnlineStatus } from './src/status/entities/online-status.entity';

// Load environment variables
config();

const configService = new ConfigService();

export default new DataSource({
  type: 'postgres',
  host: configService.get('DB_HOST', 'localhost'),
  port: configService.get<number>('DB_PORT', 5432),
  username: configService.get('DB_USERNAME', 'postgres'),
  password: configService.get('DB_PASSWORD', 'password'),
  database: configService.get('DB_NAME', 'social_service'),
  entities: [Friendship, Message, OnlineStatus],
  migrations: ['src/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: configService.get('NODE_ENV') === 'development',
});