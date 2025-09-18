import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UserServiceClient } from './user.service.client';
import { NotificationServiceClient } from './notification.service.client';
import { AchievementServiceClient } from './achievement.service.client';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000, // 5 seconds
      maxRedirects: 5,
    }),
  ],
  providers: [
    UserServiceClient,
    NotificationServiceClient,
    AchievementServiceClient,
  ],
  exports: [
    UserServiceClient,
    NotificationServiceClient,
    AchievementServiceClient,
  ],
})
export class ClientsModule {}
