import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { HealthController } from './health.controller';
import { AppService } from '../app.service';
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, GameRating]),
    CacheModule.register(),
  ],
  controllers: [HealthController],
  providers: [AppService],
})
export class HealthModule {}