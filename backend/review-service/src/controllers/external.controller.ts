import { Controller, Get, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RatingService } from '../services';

@ApiTags('External API')
@Controller('external')
export class ExternalController {
  constructor(private readonly ratingService: RatingService) {}

  @Get('games/:gameId/rating')
  @ApiOperation({ 
    summary: 'Get game rating for Game Catalog Service',
    description: 'Returns the average rating and total review count for a specific game. Used by Game Catalog Service to display ratings in the catalog.'
  })
  @ApiParam({ name: 'gameId', description: 'Game ID', example: 'game-123' })
  @ApiResponse({ 
    status: 200, 
    description: 'Game rating retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        gameId: { type: 'string', example: 'game-123' },
        averageRating: { type: 'number', example: 4.25 },
        totalReviews: { type: 'number', example: 42 },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Game rating not found',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'No rating found for this game' },
        gameId: { type: 'string', example: 'game-123' }
      }
    }
  })
  async getGameRating(@Param('gameId') gameId: string) {
    const gameRating = await this.ratingService.getGameRating(gameId);
    
    if (!gameRating) {
      throw new HttpException(
        {
          message: 'No rating found for this game',
          gameId,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      gameId: gameRating.gameId,
      averageRating: gameRating.averageRating,
      totalReviews: gameRating.totalReviews,
      updatedAt: gameRating.updatedAt,
    };
  }

  @Get('games/:gameId/rating/summary')
  @ApiOperation({ 
    summary: 'Get game rating summary for Game Catalog Service',
    description: 'Returns a simplified rating summary with just the essential information for catalog display.'
  })
  @ApiParam({ name: 'gameId', description: 'Game ID', example: 'game-123' })
  @ApiResponse({ 
    status: 200, 
    description: 'Game rating summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        rating: { type: 'number', example: 4.25, description: 'Average rating (0 if no reviews)' },
        reviewCount: { type: 'number', example: 42, description: 'Total number of reviews' },
        hasRating: { type: 'boolean', example: true, description: 'Whether the game has any ratings' }
      }
    }
  })
  async getGameRatingSummary(@Param('gameId') gameId: string) {
    const gameRating = await this.ratingService.getGameRating(gameId);
    
    if (!gameRating) {
      return {
        rating: 0,
        reviewCount: 0,
        hasRating: false,
      };
    }

    return {
      rating: gameRating.averageRating,
      reviewCount: gameRating.totalReviews,
      hasRating: true,
    };
  }

  @Get('games/ratings/batch')
  @ApiOperation({ 
    summary: 'Get ratings for multiple games',
    description: 'Returns ratings for multiple games in a single request. Used by Game Catalog Service for efficient batch operations.'
  })
  @ApiQuery({ 
    name: 'gameIds', 
    description: 'Comma-separated list of game IDs', 
    example: 'game-123,game-456,game-789',
    required: true
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Batch game ratings retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        ratings: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              rating: { type: 'number', example: 4.25 },
              reviewCount: { type: 'number', example: 42 },
              hasRating: { type: 'boolean', example: true }
            }
          },
          example: {
            'game-123': { rating: 4.25, reviewCount: 42, hasRating: true },
            'game-456': { rating: 0, reviewCount: 0, hasRating: false }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid request - gameIds parameter required'
  })
  async getBatchGameRatings(@Query('gameIds') gameIds: string) {
    if (!gameIds) {
      throw new HttpException(
        {
          message: 'gameIds parameter is required',
          example: '?gameIds=game-123,game-456,game-789'
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const gameIdList = gameIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
    
    if (gameIdList.length === 0) {
      throw new HttpException(
        {
          message: 'At least one valid gameId is required',
          example: '?gameIds=game-123,game-456,game-789'
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Limit batch size to prevent abuse
    if (gameIdList.length > 100) {
      throw new HttpException(
        {
          message: 'Maximum 100 games per batch request',
          provided: gameIdList.length
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const ratings: Record<string, { rating: number; reviewCount: number; hasRating: boolean }> = {};

    // Process each game ID
    for (const gameId of gameIdList) {
      try {
        const gameRating = await this.ratingService.getGameRating(gameId);
        
        if (gameRating) {
          ratings[gameId] = {
            rating: gameRating.averageRating,
            reviewCount: gameRating.totalReviews,
            hasRating: true,
          };
        } else {
          ratings[gameId] = {
            rating: 0,
            reviewCount: 0,
            hasRating: false,
          };
        }
      } catch (error) {
        // If individual game rating fails, return default values
        ratings[gameId] = {
          rating: 0,
          reviewCount: 0,
          hasRating: false,
        };
      }
    }

    return { ratings };
  }
}