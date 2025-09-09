import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Franchise } from '../domain/entities/franchise.entity';
import { Game } from '../domain/entities/game.entity';
import { FranchiseService } from '../application/services/franchise.service';
import { FranchiseController } from '../infrastructure/http/controllers/franchise.controller';
import { FranchiseRepository } from '../infrastructure/persistence/franchise.repository';
import { GameRepository } from '../infrastructure/persistence/game.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Franchise, Game])],
  providers: [FranchiseService, FranchiseRepository, GameRepository],
  controllers: [FranchiseController],
  exports: [FranchiseService],
})
export class FranchiseModule {}
