import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionService } from '../application/services/promotion.service';
import { PromotionController } from '../infrastructure/http/controllers/promotion.controller';
import { Discount } from '../domain/entities/discount.entity';
import { Game } from '../domain/entities/game.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Discount, Game])],
  providers: [PromotionService],
  controllers: [PromotionController],
})
export class PromotionModule {}
