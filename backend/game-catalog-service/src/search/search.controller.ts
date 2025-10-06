import {
  Controller,
  Get,
  Query,
  UseInterceptors,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchGamesDto } from '../dto/search-games.dto';
import { GameListResponse } from '../interfaces/game.interface';
import { HttpCacheInterceptor } from '../common/interceptors/http-cache.interceptor';
import { PerformanceInterceptor } from '../common/interceptors/performance.interceptor';
import {
  TimeoutInterceptor,
  Timeout,
} from '../common/interceptors/timeout.interceptor';
import {
  ResponseTransformationInterceptor,
  TransformResponse, // eslint-disable-line @typescript-eslint/no-unused-vars
  ExcludeTransform,
} from '../common/interceptors/response-transformation.interceptor';
import { Cache } from '../common/decorators/cache.decorator';

@ApiTags('Games')
@Controller('search')
@UseInterceptors(
  TimeoutInterceptor,
  HttpCacheInterceptor,
  PerformanceInterceptor,
  ResponseTransformationInterceptor,
)
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(private readonly searchService: SearchService) {}

  @Get('search')
  @Cache('search_{{query}}', 300) // 5 minutes TTL for search results
  @Timeout(12000) // 12 seconds timeout for search operations
  @ExcludeTransform()
  @ApiOperation({
    summary: 'Search for games by title, description, or all fields',
    description:
      'Search games using PostgreSQL full-text search with Russian language support. Supports pagination, price filtering, and different search types.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search query string (1-255 characters)',
    example: 'cyberpunk',
  })
  @ApiQuery({
    name: 'searchType',
    required: false,
    enum: ['title', 'description', 'all'],
    description: 'Type of search to perform',
    example: 'title',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (1-based)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page (1-100)',
    example: 10,
  })
  @ApiQuery({
    name: 'minPrice',
    required: false,
    description: 'Minimum price filter',
    example: 100,
  })
  @ApiQuery({
    name: 'maxPrice',
    required: false,
    description: 'Maximum price filter',
    example: 5000,
  })
  @ApiResponse({
    status: 200,
    description: 'A paginated list of games matching the search criteria.',
    schema: {
      type: 'object',
      properties: {
        games: {
          type: 'array',
          items: { $ref: '#/components/schemas/Game' },
        },
        total: {
          type: 'number',
          description: 'Total number of games matching the search criteria',
        },
        page: {
          type: 'number',
          description: 'Current page number',
        },
        limit: {
          type: 'number',
          description: 'Number of items per page',
        },
        hasNext: {
          type: 'boolean',
          description: 'Whether there are more pages available',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid search parameters',
    schema: {
      type: 'object',
      properties: {
        error: {
          type: 'object',
          properties: {
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            message: {
              type: 'string',
              example: 'Search query must be at least 1 character long',
            },
            details: { type: 'object' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during search operation',
    schema: {
      type: 'object',
      properties: {
        error: {
          type: 'object',
          properties: {
            code: { type: 'string', example: 'INTERNAL_SERVER_ERROR' },
            message: { type: 'string', example: 'Search operation failed' },
          },
        },
      },
    },
  })
  async searchGames(
    @Query() searchGamesDto: SearchGamesDto,
  ): Promise<GameListResponse> {
    try {
      this.logger.log(`Search request: ${JSON.stringify(searchGamesDto)}`);

      // Allow empty search queries to return all games
      if (
        searchGamesDto.q !== undefined &&
        searchGamesDto.q.trim().length === 0
      ) {
        searchGamesDto.q = undefined; // Convert empty string to undefined for "show all" behavior
      }

      if (
        searchGamesDto.minPrice !== undefined &&
        searchGamesDto.maxPrice !== undefined
      ) {
        if (searchGamesDto.minPrice > searchGamesDto.maxPrice) {
          throw new HttpException(
            'Minimum price cannot be greater than maximum price',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      if (
        searchGamesDto.minPrice !== undefined &&
        searchGamesDto.minPrice < 0
      ) {
        throw new HttpException(
          'Minimum price cannot be negative',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (
        searchGamesDto.maxPrice !== undefined &&
        searchGamesDto.maxPrice < 0
      ) {
        throw new HttpException(
          'Maximum price cannot be negative',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.searchService.searchGames(searchGamesDto);

      this.logger.log(`Search completed: found ${result.total} games`);

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Search operation failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new HttpException(
        'Search operation failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
