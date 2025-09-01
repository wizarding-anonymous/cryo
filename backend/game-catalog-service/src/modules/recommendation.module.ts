import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from '../domain/entities/game.entity';
import { GameRepository } from '../infrastructure/persistence/game.repository';
import { RecommendationService } from '../application/services/recommendation.service';
import { RecommendationController } from '../infrastructure/http/controllers/recommendation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Game])],
  providers: [RecommendationService, GameRepository],
  controllers: [RecommendationController],
})
export class RecommendationModule {}
