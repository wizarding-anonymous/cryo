import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { PreorderService } from '../../../application/services/preorder.service';

class CreatePreorderDto {
    startDate: Date;
    releaseDate: Date;
}

class CreatePreorderTierDto {
    name: string;
    price: number;
    bonuses: any;
}

@Controller('games/:gameId/preorder')
export class PreorderController {
  constructor(private readonly preorderService: PreorderService) {}

  @Post()
  createPreorder(@Param('gameId') gameId: string, @Body() createPreorderDto: CreatePreorderDto) {
    return this.preorderService.createPreorder(gameId, createPreorderDto);
  }

  @Get()
  getPreorder(@Param('gameId') gameId: string) {
    return this.preorderService.getPreorderForGame(gameId);
  }

  @Post('tiers')
  addTier(@Param('gameId') gameId: string, @Body() createTierDto: CreatePreorderTierDto) {
    // This is simplified. In a real app, you'd get the preorderId from the gameId.
    // For now, let's assume we pass it, though the route doesn't support it well.
    // This highlights a design complexity to be solved.
    // const preorder = await this.preorderService.getPreorderForGame(gameId);
    // return this.preorderService.addTierToPreorder(preorder.id, createTierDto);
    return 'Tier creation endpoint placeholder';
  }
}
