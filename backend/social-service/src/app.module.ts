import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FriendsModule } from './friends/friends.module';
import { MessagesModule } from './messages/messages.module';
import { StatusModule } from './status/status.module';
import { HealthModule } from './health/health.module';
import { ClientsModule } from './clients/clients.module';
import { CacheConfigModule } from './cache/cache.module';
import { Friendship } from './friends/entities/friendship.entity';
import { Message } from './messages/entities/message.entity';
import { OnlineStatus } from './status/entities/online-status.entity';

@Module({
  imports: [
    // Database Configuration
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'postgres',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USERNAME || 'user',
      password: process.env.DATABASE_PASSWORD || 'password',
      database: process.env.DATABASE_NAME || 'social_db',
      entities: [Friendship, Message, OnlineStatus],
      synchronize: process.env.NODE_ENV !== 'production', // For MVP, we use synchronize. Migrations would be for production.
      logging: process.env.NODE_ENV === 'development',
      migrations: ['dist/database/migrations/*.js'],
      migrationsTableName: 'migrations',
      migrationsRun: false, // We'll run migrations manually for production
    }),
    // Cache Configuration (Redis)
    CacheConfigModule,
    // Feature Modules
    FriendsModule,
    MessagesModule,
    StatusModule,
    HealthModule,
    ClientsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
