import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from '../../domain/entities/game.entity';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { GameService } from '../../application/services/game.service';
import { GameController } from '../../infrastructure/http/controllers/game.controller';
import { SearchModule } from './search.module';
import { AnalyticsModule } from './analytics.module';
import { LocalizationModule } from './localization.module';
import { RequirementsModule } from './requirements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game]),
    SearchModule,
    AnalyticsModule,
    LocalizationModule,
    RequirementsModule,
  ],
  providers: [GameRepository, GameService],
  controllers: [GameController],
  exports: [GameService, GameRepository],
})
export class GameModule {}
