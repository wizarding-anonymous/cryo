import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { PromotionService } from '../../../application/services/promotion.service';

class CreateDiscountDto {
    gameId: string;
    percentage: number;
    startDate: Date;
    endDate: Date;
}

@Controller('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Post('discounts')
  createDiscount(@Body() createDiscountDto: CreateDiscountDto) {
    const { gameId, percentage, startDate, endDate } = createDiscountDto;
    return this.promotionService.createDiscount(gameId, percentage, startDate, endDate);
  }

  @Get('discounts/game/:gameId')
  getActiveDiscountsForGame(@Param('gameId') gameId: string) {
    return this.promotionService.getActiveDiscountsForGame(gameId);
  }
}
