import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from '../domain/entities/game.entity';
import { GameRepository } from '../infrastructure/persistence/game.repository';
import { GameService } from '../application/services/game.service';
import { DeveloperController } from '../infrastructure/http/controllers/developer.controller';
import { SearchModule } from './search.module';
import { GameModule } from './game.module';
import { ModerationModule } from './moderation.module';
import { VersionModule } from './version.module';
import { RequirementsModule } from './requirements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game]),
    SearchModule,
    GameModule,
    ModerationModule,
    VersionModule,
    RequirementsModule,
  ],
  providers: [],
  controllers: [DeveloperController],
})
export class DeveloperModule {}
