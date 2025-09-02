import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameEdition } from '../domain/entities/game-edition.entity';
import { Game } from '../domain/entities/game.entity';
import { EditionService } from '../application/services/edition.service';
import { EditionController } from '../infrastructure/http/controllers/edition.controller';
import { GameRepository } from '../infrastructure/persistence/game.repository';

@Module({
  imports: [TypeOrmModule.forFeature([GameEdition, Game])],
  providers: [EditionService, GameRepository],
  controllers: [EditionController],
  exports: [EditionService],
})
export class EditionModule {}
