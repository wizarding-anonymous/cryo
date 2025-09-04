import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from '../domain/entities/game.entity';
import { GameRepository } from '../infrastructure/persistence/game.repository';
import { GameService } from '../application/services/game.service';
import { DeveloperController } from '../infrastructure/http/controllers/developer.controller';
import { SearchModule } from './search.module';
import { GameModule } from './game.module';
import { GameModule } from './game.module';
import { ModerationModule } from './moderation.module';
import { LocalizationModule } from './localization.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game]),
    SearchModule,
    GameModule,
    ModerationModule,
    LocalizationModule,
  ],
  providers: [],
  controllers: [DeveloperController],
})
export class DeveloperModule {}
