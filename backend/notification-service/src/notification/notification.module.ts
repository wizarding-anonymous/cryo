import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpModule } from '@nestjs/axios';
import { Notification } from '../../entities/notification.entity';
import { NotificationSettings } from '../../entities/notification-settings.entity';
import { NotificationService } from './notification.service';
import { EmailService } from './email.service';
import { NotificationController } from './notification.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationSettings]),
    CacheModule.register(),
    HttpModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, EmailService],
  exports: [NotificationService],
})
export class NotificationModule {}
