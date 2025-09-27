import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { OwnershipService } from '../services/ownership.service';
import { NotificationService } from '../services/notification.service';
import { GameCatalogService } from '../services/game-catalog.service';
import { AchievementService } from '../services/achievement.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule,
  ],
  controllers: [MonitoringController],
  providers: [
    MonitoringService,
    OwnershipService,
    NotificationService,
    GameCatalogService,
    AchievementService,
  ],
  exports: [MonitoringService],
})
export class MonitoringModule {}