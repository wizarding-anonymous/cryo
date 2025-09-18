import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';
import { ReviewsService } from './reviews.service';
import { RatingsService } from './ratings.service';
import { OwnershipService } from './ownership.service';
import { ReviewsController } from './reviews.controller';
import { RatingsController } from './ratings.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, GameRating]),
    HttpModule,
    CacheModule.register(),
  ],
  controllers: [ReviewsController, RatingsController],
  providers: [ReviewsService, RatingsService, OwnershipService],
  exports: [ReviewsService, RatingsService],
})
export class ReviewsModule {}
