import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';
import { OwnershipService } from '../services/ownership.service';
import { NotificationService } from '../services/notification.service';
import { GameCatalogService } from '../services/game-catalog.service';
import { AchievementService } from '../services/achievement.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, GameRating]),
    HttpModule,
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    OwnershipService,
    NotificationService,
    GameCatalogService,
    AchievementService,
  ],
  exports: [HealthService],
})
export class HealthModule {}