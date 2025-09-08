import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VersionService } from '../application/services/version.service';
import { GameVersionRepository } from '../infrastructure/persistence/game-version.repository';
import { GameRepository } from '../infrastructure/persistence/game.repository';
import { Game } from '../domain/entities/game.entity';
import { GameVersion } from '../domain/entities/game-version.entity';
import { EventPublisherModule } from './event-publisher.module';

@Module({
  imports: [TypeOrmModule.forFeature([Game, GameVersion]), EventPublisherModule],
  providers: [VersionService, GameVersionRepository, GameRepository],
  exports: [VersionService],
})
export class VersionModule {}
