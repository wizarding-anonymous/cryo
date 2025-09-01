import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DlcService } from '../application/services/dlc.service';
import { DlcController } from '../infrastructure/http/controllers/dlc.controller';
import { Dlc } from '../domain/entities/dlc.entity';
import { Game } from '../domain/entities/game.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Dlc, Game])],
  providers: [DlcService],
  controllers: [DlcController],
})
export class DlcModule {}
