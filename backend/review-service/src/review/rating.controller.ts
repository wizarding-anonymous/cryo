import {
  Controller,
  Get,
  Param,
  Query,
  UseInterceptors,
  ParseUUIDPipe,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { RatingService } from '../services/rating.service';

@ApiTags('ratings')
@Controller('ratings')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Get('game/:gameId')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({
    summary: 'Получить рейтинг игры',
    description: 'Возвращает средний рейтинг и количество отзывов для игры. Результат кешируется на 5 минут.',
  })
  @ApiParam({
    name: 'gameId',
    description: 'ID игры',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Рейтинг игры',
    schema: {
      example: {
        gameId: 'game-uuid',
        averageRating: 4.2,
        totalReviews: 15,
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Игра не найдена или нет отзывов',
    schema: {
      example: {
        gameId: 'game-uuid',
        averageRating: 0,
        totalReviews: 0,
        message: 'No reviews found for this game',
      },
    },
  })
  async getGameRating(@Param('gameId', ParseUUIDPipe) gameId: string) {
    return this.ratingService.getGameRating(gameId);
  }

  @Get('top')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({
    summary: 'Получить топ игр по рейтингу',
    description: 'Возвращает список игр с наивысшим рейтингом (минимум 5 отзывов). Результат кешируется.',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Количество игр в топе',
    required: false,
    type: 'number',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список топ игр',
    schema: {
      example: [
        {
          gameId: 'game-uuid-1',
          averageRating: 4.8,
          totalReviews: 25,
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          gameId: 'game-uuid-2',
          averageRating: 4.7,
          totalReviews: 18,
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    },
  })
  async getTopRatedGames(@Query('limit') limit: number = 10) {
    return this.ratingService.getTopRatedGames(limit);
  }
}