import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Preorder } from '../domain/entities/preorder.entity';
import { PreorderTier } from '../domain/entities/preorder-tier.entity';
import { Game } from '../domain/entities/game.entity';
import { PreorderService } from '../application/services/preorder.service';
import { PreorderController } from '../infrastructure/http/controllers/preorder.controller';
import { GameRepository } from '../infrastructure/persistence/game.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Preorder, PreorderTier, Game])],
  providers: [PreorderService, GameRepository],
  controllers: [PreorderController],
  exports: [PreorderService],
})
export class PreorderModule {}
