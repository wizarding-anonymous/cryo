import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FriendsModule } from './friends/friends.module';
import { MessagesModule } from './messages/messages.module';
import { StatusModule } from './status/status.module';
import { HealthModule } from './common/health/health.module';
import { ClientsModule } from './clients/clients.module';
import { IntegrationModule } from './integration/integration.module';
import { getDatabaseConfig } from './common/config/database.config';
import { getRedisConfig } from './common/config/redis.config';

@Module({
  imports: [
    // Configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database configuration with PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),

    // Cache configuration with Redis
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: getRedisConfig,
      inject: [ConfigService],
      isGlobal: true,
    }),

    // Schedule module for cron jobs
    ScheduleModule.forRoot(),

    // Common modules
    HealthModule,
    ClientsModule,

    // Feature modules
    FriendsModule,
    MessagesModule,
    StatusModule,
    IntegrationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
