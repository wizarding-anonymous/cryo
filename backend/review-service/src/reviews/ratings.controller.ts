import {
  Controller,
  Get,
  Param,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { RatingsService } from './ratings.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GameRating } from '../entities/game-rating.entity';

@ApiTags('ratings')
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get('game/:gameId')
  @UseInterceptors(CacheInterceptor) // Caching will be handled by the global CacheModule config
  @ApiOperation({ summary: "Get a game's average rating and total number of reviews" })
  @ApiResponse({ status: 200, description: 'Returns the game rating data.', type: GameRating })
  getGameRating(@Param('gameId', ParseUUIDPipe) gameId: string): Promise<GameRating> {
    return this.ratingsService.getGameRating(gameId);
  }
}
