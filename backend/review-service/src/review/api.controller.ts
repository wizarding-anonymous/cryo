import {
  Controller,
  Get,
  Param,
  Query,
  HttpStatus,
  Logger,
  UseGuards,
  Post,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RatingService } from '../services/rating.service';
import { ReviewService } from '../services/review.service';
import { ExternalIntegrationService } from '../services/external-integration.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PaginationDto } from '../dto/pagination.dto';

@ApiTags('api')
@Controller('api/v1')
export class ApiController {
  private readonly logger = new Logger(ApiController.name);

  constructor(
    private readonly ratingService: RatingService,
    private readonly reviewService: ReviewService,
    private readonly externalIntegrationService: ExternalIntegrationService,
  ) {}

  @Get('games/:gameId/rating')
  @ApiOperation({
    summary: 'Получить рейтинг игры для Game Catalog Service',
    description: 'Возвращает средний рейтинг и количество отзывов для указанной игры',
  })
  @ApiParam({
    name: 'gameId',
    description: 'ID игры',
    example: 'game-123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Рейтинг игры успешно получен',
    schema: {
      example: {
        gameId: 'game-123',
        averageRating: 4.25,
        totalReviews: 150,
        lastUpdated: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Игра не найдена или нет отзывов',
    schema: {
      example: {
        gameId: 'game-123',
        averageRating: 0,
        totalReviews: 0,
        lastUpdated: null,
      },
    },
  })
  async getGameRating(@Param('gameId') gameId: string) {
    this.logger.debug(`API request for game rating: ${gameId}`);

    const gameRating = await this.ratingService.getGameRating(gameId);

    if (!gameRating || gameRating.totalReviews === 0) {
      return {
        gameId,
        averageRating: 0,
        totalReviews: 0,
        lastUpdated: null,
      };
    }

    return {
      gameId: gameRating.gameId,
      averageRating: gameRating.averageRating,
      totalReviews: gameRating.totalReviews,
      lastUpdated: gameRating.updatedAt,
    };
  }

  @Get('games/:gameId/reviews')
  @ApiOperation({
    summary: 'Получить отзывы игры для внешних сервисов',
    description: 'Возвращает список отзывов для указанной игры с пагинацией',
  })
  @ApiParam({
    name: 'gameId',
    description: 'ID игры',
    example: 'game-123',
  })
  @ApiQuery({
    name: 'page',
    description: 'Номер страницы',
    example: 1,
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Количество отзывов на странице',
    example: 10,
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Отзывы успешно получены',
    schema: {
      example: {
        gameId: 'game-123',
        reviews: [
          {
            id: 'review-456',
            userId: 'user-789',
            rating: 5,
            text: 'Отличная игра!',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 150,
          totalPages: 15,
        },
      },
    },
  })
  async getGameReviews(
    @Param('gameId') gameId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    this.logger.debug(`API request for game reviews: ${gameId}`);

    const result = await this.reviewService.getGameReviews(gameId, paginationDto);

    return {
      gameId,
      reviews: result.reviews,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @Get('games/ratings/bulk')
  @ApiOperation({
    summary: 'Получить рейтинги нескольких игр',
    description: 'Возвращает рейтинги для списка игр (для Game Catalog Service)',
  })
  @ApiQuery({
    name: 'gameIds',
    description: 'Список ID игр через запятую',
    example: 'game-123,game-456,game-789',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Рейтинги игр успешно получены',
    schema: {
      example: {
        ratings: [
          {
            gameId: 'game-123',
            averageRating: 4.25,
            totalReviews: 150,
            lastUpdated: '2024-01-01T00:00:00.000Z',
          },
          {
            gameId: 'game-456',
            averageRating: 3.8,
            totalReviews: 75,
            lastUpdated: '2024-01-01T00:00:00.000Z',
          },
        ],
      },
    },
  })
  async getBulkGameRatings(@Query('gameIds') gameIdsParam: string) {
    this.logger.debug(`API request for bulk game ratings: ${gameIdsParam}`);

    if (!gameIdsParam) {
      return { ratings: [] };
    }

    const gameIds = gameIdsParam.split(',').map(id => id.trim()).filter(Boolean);

    if (gameIds.length === 0) {
      return { ratings: [] };
    }

    // Ограничиваем количество игр для предотвращения перегрузки
    const limitedGameIds = gameIds.slice(0, 100);

    const ratings = await Promise.allSettled(
      limitedGameIds.map(async (gameId) => {
        const gameRating = await this.ratingService.getGameRating(gameId);
        
        if (!gameRating || gameRating.totalReviews === 0) {
          return {
            gameId,
            averageRating: 0,
            totalReviews: 0,
            lastUpdated: null,
          };
        }

        return {
          gameId: gameRating.gameId,
          averageRating: gameRating.averageRating,
          totalReviews: gameRating.totalReviews,
          lastUpdated: gameRating.updatedAt,
        };
      })
    );

    const successfulRatings = ratings
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);

    return { ratings: successfulRatings };
  }

  @Get('users/:userId/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Получить отзывы пользователя',
    description: 'Возвращает список отзывов указанного пользователя',
  })
  @ApiParam({
    name: 'userId',
    description: 'ID пользователя',
    example: 'user-123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Отзывы пользователя успешно получены',
  })
  async getUserReviews(
    @Param('userId') userId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    this.logger.debug(`API request for user reviews: ${userId}`);

    const result = await this.reviewService.getUserReviews(userId, paginationDto);

    return {
      userId,
      reviews: result.reviews,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @Get('statistics/ratings')
  @ApiOperation({
    summary: 'Получить статистику рейтингов',
    description: 'Возвращает общую статистику по рейтингам игр',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статистика рейтингов успешно получена',
    schema: {
      example: {
        totalGamesWithRatings: 1250,
        averageRatingAcrossAllGames: 4.1,
        totalReviewsCount: 15750,
        topRatedGames: [
          {
            gameId: 'game-123',
            averageRating: 4.9,
            totalReviews: 200,
          },
        ],
      },
    },
  })
  async getRatingStatistics() {
    this.logger.debug('API request for rating statistics');

    const [stats, topRatedGames] = await Promise.all([
      this.ratingService.getGameRatingStats(),
      this.ratingService.getTopRatedGames(10),
    ]);

    return {
      ...stats,
      topRatedGames: topRatedGames.map(rating => ({
        gameId: rating.gameId,
        averageRating: rating.averageRating,
        totalReviews: rating.totalReviews,
      })),
    };
  }

  @Post('integrations/library/ownership-check')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Проверить владение игрой через Library Service',
    description: 'Проверяет, владеет ли пользователь указанной игрой',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Проверка владения выполнена',
    schema: {
      example: {
        userId: 'user-123',
        gameId: 'game-456',
        ownsGame: true,
        checkedAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  async checkGameOwnership(
    @Body() body: { userId: string; gameId: string },
  ) {
    this.logger.debug(`API request for ownership check: user ${body.userId}, game ${body.gameId}`);

    const ownsGame = await this.reviewService.getUserReviews(body.userId, { page: 1, limit: 1 });

    return {
      userId: body.userId,
      gameId: body.gameId,
      ownsGame: ownsGame.total > 0,
      checkedAt: new Date().toISOString(),
    };
  }

  @Get('health/integrations')
  @ApiOperation({
    summary: 'Проверить состояние интеграций с внешними сервисами',
    description: 'Возвращает статус подключения к Library, Game Catalog, Achievement и Notification сервисам',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Статус интеграций получен',
    schema: {
      example: {
        library: true,
        gameCatalog: true,
        achievement: false,
        notification: true,
        checkedAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  async getIntegrationsHealth() {
    this.logger.debug('API request for integrations health check');

    const healthStatus = await this.reviewService.getServiceHealthStatus();

    return {
      ...healthStatus,
      checkedAt: new Date().toISOString(),
    };
  }
}