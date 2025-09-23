import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { AppService } from '../app.service';
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, GameRating]),
    CacheModule.register(),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 3,
    }),
  ],
  controllers: [HealthController],
  providers: [AppService],
})
export class HealthModule {}