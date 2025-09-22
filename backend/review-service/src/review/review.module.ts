import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';
import { ReviewService } from '../services/review.service';
import { RatingService } from '../services/rating.service';
import { OwnershipService } from '../services/ownership.service';
import { ExternalIntegrationService } from '../services/external-integration.service';
import { MetricsService } from '../services/metrics.service';
import { RatingSchedulerService } from '../services/rating-scheduler.service';
import { ReviewController } from './review.controller';
import { RatingController } from './rating.controller';
import { MetricsController } from './metrics.controller';
import { ApiController } from './api.controller';
import { OwnershipGuard } from '../guards';

@Module({
    imports: [
        TypeOrmModule.forFeature([Review, GameRating]),
        HttpModule.register({
            timeout: 5000,
            maxRedirects: 5,
        }),
        ScheduleModule.forRoot(),
    ],
    controllers: [
        ReviewController,
        RatingController,
        MetricsController,
        ApiController,
    ],
    providers: [
        ReviewService,
        RatingService,
        OwnershipService,
        ExternalIntegrationService,
        MetricsService,
        RatingSchedulerService,
        OwnershipGuard,
    ],
    exports: [
        ReviewService,
        RatingService,
        OwnershipService,
        ExternalIntegrationService,
        MetricsService,
        RatingSchedulerService,
    ],
})
export class ReviewModule { }