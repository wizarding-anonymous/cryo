import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { MetricsService } from '../services/metrics.service';
import { WebhookAuthGuard } from '../guards/webhook-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, GameRating]),
  ],
  controllers: [WebhookController],
  providers: [
    WebhookService,
    MetricsService,
    WebhookAuthGuard,
  ],
  exports: [
    WebhookService,
  ],
})
export class WebhookModule {}