import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from '../../domain/entities/game.entity';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { GameService } from '../../application/services/game.service';
import { GameController } from '../../infrastructure/http/controllers/game.controller';
import { SearchModule } from './search.module';
import { AnalyticsModule } from './analytics.module';

@Module({
  imports: [TypeOrmModule.forFeature([Game]), SearchModule, AnalyticsModule],
  providers: [GameRepository, GameService],
  controllers: [GameController],
})
export class GameModule {}
