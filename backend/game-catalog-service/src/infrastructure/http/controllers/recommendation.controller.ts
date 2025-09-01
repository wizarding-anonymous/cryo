import { Controller, Get, Param } from '@nestjs/common';
import { RecommendationService } from '../../../application/services/recommendation.service';

@Controller('games/:id/recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Get('similar')
  findSimilar(@Param('id') id: string) {
    return this.recommendationService.findSimilarGames(id);
  }
}
