import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { FriendsModule } from './friends/friends.module';
import { MessagesModule } from './messages/messages.module';
import { StatusModule } from './status/status.module';
import { HealthModule } from './health/health.module';
import { ClientsModule } from './clients/clients.module';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: 'redis', // Using docker service name
      port: 6379,
      ttl: 900, // 15 minutes, as per status requirements
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'postgres', // Using docker service name
      port: 5432,
      username: 'user',
      password: 'password',
      database: 'social_db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // For MVP, we use synchronize. Migrations would be for production.
    }),
    FriendsModule,
    MessagesModule,
    StatusModule,
    HealthModule,
    ClientsModule, // Add the new clients module
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
