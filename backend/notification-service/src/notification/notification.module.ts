import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Notification } from '../entities/notification.entity';
import { NotificationSettings } from '../entities/notification-settings.entity';
import { NotificationService } from './notification.service';
import { EmailService } from './email.service';
import { NotificationController } from './notification.controller';
import { NotificationIntegrationService } from './integration.service';
import { CacheRedisModule } from '../cache/cache.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Notification, NotificationSettings]),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // For MVP, we'll use memory store but with Redis-ready configuration
        // In production, this can be easily switched to Redis store
        const useRedis = configService.get<boolean>('USE_REDIS_CACHE', false);

        if (useRedis) {
          // Redis configuration for future use
          console.log(
            'Redis cache configuration detected but using memory store for MVP',
          );
        }

        return {
          ttl: 3600, // 1 hour default TTL in seconds
          max: 1000, // Maximum number of items in cache
        };
      },
      inject: [ConfigService],
    }),
    HttpModule,
    CacheRedisModule,
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    EmailService,
    NotificationIntegrationService,
  ],
  exports: [NotificationService, NotificationIntegrationService],
})
export class NotificationModule {}
