import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequirementsService } from '../application/services/requirements.service';
import { GameRepository } from '../infrastructure/persistence/game.repository';
import { Game } from '../domain/entities/game.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Game])],
  providers: [RequirementsService, GameRepository],
  exports: [RequirementsService],
})
export class RequirementsModule {}
