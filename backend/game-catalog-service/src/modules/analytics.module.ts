import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from '../domain/entities/game.entity';
import { GameRepository } from '../infrastructure/persistence/game.repository';
import { AnalyticsService } from '../application/services/analytics.service';
import { AnalyticsListener } from '../infrastructure/events/analytics.listener';

@Module({
  imports: [TypeOrmModule.forFeature([Game])],
  providers: [AnalyticsService, GameRepository],
  controllers: [AnalyticsListener],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
