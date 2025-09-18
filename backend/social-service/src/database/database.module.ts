import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Friendship } from '../friends/entities/friendship.entity';
import { Message } from '../messages/entities/message.entity';
import { OnlineStatus } from '../status/entities/online-status.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'postgres',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USERNAME || 'user',
      password: process.env.DATABASE_PASSWORD || 'password',
      database: process.env.DATABASE_NAME || 'social_db',
      entities: [Friendship, Message, OnlineStatus],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
      migrations: ['dist/database/migrations/*.js'],
      migrationsTableName: 'migrations',
      migrationsRun: false,
    }),
  ],
})
export class DatabaseModule {}