import {
  Controller,
  Get,
  Param,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { RatingService } from '../services/rating.service';
import { GameRating } from '../entities/game-rating.entity';

@ApiTags('ratings')
@Controller('ratings')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Get('game/:gameId')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get rating for a specific game' })
  @ApiParam({
    name: 'gameId',
    description: 'ID of the game to get rating for',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Game rating retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        gameId: {
          type: 'string',
          description: 'ID of the game',
        },
        averageRating: {
          type: 'number',
          description: 'Average rating (0-5 stars)',
          example: 4.25,
        },
        totalReviews: {
          type: 'number',
          description: 'Total number of reviews',
          example: 42,
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          description: 'Last time the rating was updated',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Game rating not found (no reviews yet)',
    schema: {
      type: 'object',
      properties: {
        gameId: {
          type: 'string',
        },
        averageRating: {
          type: 'number',
          example: 0,
        },
        totalReviews: {
          type: 'number',
          example: 0,
        },
        message: {
          type: 'string',
          example: 'No reviews yet',
        },
      },
    },
  })
  async getGameRating(@Param('gameId') gameId: string): Promise<GameRating | { gameId: string; averageRating: number; totalReviews: number; message: string }> {
    const rating = await this.ratingService.getGameRating(gameId);
    
    if (!rating) {
      return {
        gameId,
        averageRating: 0,
        totalReviews: 0,
        message: 'No reviews yet',
      };
    }
    
    return rating;
  }
}