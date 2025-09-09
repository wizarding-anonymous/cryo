import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dlc } from '../domain/entities/dlc.entity';
import { Game } from '../domain/entities/game.entity';
import { DlcService } from '../application/services/dlc.service';
import { DlcController } from '../infrastructure/http/controllers/dlc.controller';
import { DlcRepository } from '../infrastructure/persistence/dlc.repository';
import { GameRepository } from '../infrastructure/persistence/game.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Dlc, Game])],
  providers: [DlcService, DlcRepository, GameRepository],
  controllers: [DlcController],
  exports: [DlcService],
})
export class DlcModule {}
