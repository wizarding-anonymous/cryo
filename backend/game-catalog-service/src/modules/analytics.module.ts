import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from '../domain/entities/game.entity';
import { GameRepository } from '../infrastructure/persistence/game.repository';
import { AnalyticsService } from '../application/services/analytics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Game])],
  providers: [AnalyticsService, GameRepository],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
