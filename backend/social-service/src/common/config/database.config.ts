import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Friendship } from '../../friends/entities/friendship.entity';
import { Message } from '../../messages/entities/message.entity';
import { OnlineStatus } from '../../status/entities/online-status.entity';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('DB_HOST', 'localhost'),
  port: configService.get<number>('DB_PORT', 5432),
  username: configService.get('DB_USERNAME', 'postgres'),
  password: configService.get('DB_PASSWORD', 'password'),
  database: configService.get('DB_NAME', 'social_service'),
  entities: [Friendship, Message, OnlineStatus],
  synchronize: configService.get('NODE_ENV') !== 'production',
  logging: configService.get('NODE_ENV') === 'development',
  migrations: ['dist/migrations/*{.ts,.js}'],
  migrationsRun: false,
  ssl: configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
  // Connection pool settings for better performance
  extra: {
    max: 20, // Maximum number of connections in the pool
    min: 5, // Minimum number of connections in the pool
    acquire: 30000, // Maximum time to wait for a connection
    idle: 10000, // Maximum time a connection can be idle
  },
});
