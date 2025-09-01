import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EditionService } from '../application/services/edition.service';
import { EditionController } from '../infrastructure/http/controllers/edition.controller';
import { GameEdition } from '../domain/entities/game-edition.entity';
import { Game } from '../domain/entities/game.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GameEdition, Game])],
  providers: [EditionService],
  controllers: [EditionController],
})
export class EditionModule {}
