import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Discount } from '../domain/entities/discount.entity';
import { Game } from '../domain/entities/game.entity';
import { PromotionService } from '../application/services/promotion.service';
import { PromotionController } from '../infrastructure/http/controllers/promotion.controller';
import { GameRepository } from '../infrastructure/persistence/game.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Discount, Game])],
  providers: [PromotionService, GameRepository],
  controllers: [PromotionController],
  exports: [PromotionService],
})
export class PromotionModule {}
