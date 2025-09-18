import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AchievementController } from './controllers/achievement.controller';
import { ProgressController } from './controllers/progress.controller';
import { AchievementService } from './services/achievement.service';
import { ProgressService } from './services/progress.service';
import { EventService } from './services/event.service';
import { Achievement, UserAchievement, UserProgress } from './entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Achievement, UserAchievement, UserProgress]),
  ],
  controllers: [AchievementController, ProgressController],
  providers: [AchievementService, ProgressService, EventService],
  exports: [AchievementService, ProgressService],
})
export class AchievementModule {}
