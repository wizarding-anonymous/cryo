import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FranchiseService } from '../application/services/franchise.service';
import { FranchiseController } from '../infrastructure/http/controllers/franchise.controller';
import { Franchise } from '../domain/entities/franchise.entity';
import { Game } from '../domain/entities/game.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Franchise, Game])],
  providers: [FranchiseService],
  controllers: [FranchiseController],
})
export class FranchiseModule {}
