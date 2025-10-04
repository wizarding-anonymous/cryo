import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  UseInterceptors,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { GameService } from './game.service';
import { SearchService } from '../search/search.service';
import { SearchGamesDto } from '../dto/search-games.dto';
import { GetGamesDto } from '../dto/get-games.dto';
import { GameResponseDto } from '../dto/game-response.dto';
import { GameListResponseDto } from '../dto/game-list-response.dto';
import { PurchaseInfoDto } from '../dto/purchase-info.dto';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { CreateGameDto } from '../dto/create-game.dto';
import { UpdateGameDto } from '../dto/update-game.dto';
import { HttpCacheInterceptor } from '../common/interceptors/http-cache.interceptor';
import { PerformanceInterceptor } from '../common/interceptors/performance.interceptor';
import {
  TimeoutInterceptor,
  Timeout,
} from '../common/interceptors/timeout.interceptor';
import {
  ResponseTransformationInterceptor,
  TransformResponse,
  ExcludeTransform,
} from '../common/interceptors/response-transformation.interceptor';
import { Cache } from '../common/decorators/cache.decorator';

@ApiTags('Games')
@Controller('games')
@UseInterceptors(
  TimeoutInterceptor,
  HttpCacheInterceptor,
  PerformanceInterceptor,
  ResponseTransformationInterceptor,
)
export class GameController {
  constructor(
    private readonly gameService: GameService,
    private readonly searchService: SearchService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get a paginated list of games',
    description:
      'Retrieve a paginated list of available games with optional filtering and sorting',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved list of games',
    type: GameListResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameters',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error',
    type: ErrorResponseDto,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 10, max: 100)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Sort field (title, price, releaseDate, createdAt)',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Sort order (ASC, DESC)',
  })
  @ApiQuery({ name: 'genre', required: false, description: 'Filter by genre' })
  @ApiQuery({
    name: 'available',
    required: false,
    description: 'Filter by availability',
  })
  @Cache('games_list_{{query}}', 600) // 10 minutes TTL for game lists
  @Timeout(15000) // 15 seconds timeout for list operations
  @ExcludeTransform()
  async getGames(
    @Query() getGamesDto: GetGamesDto,
  ): Promise<GameListResponseDto> {
    const result = await this.gameService.getAllGames(getGamesDto);

    // Transform Game entities to GameResponseDto
    const gameResponseDtos = result.games.map(
      (game) => new GameResponseDto(game),
    );

    return new GameListResponseDto(
      gameResponseDtos,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search for games',
    description: 'Search games using various criteria and filters',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved search results',
    type: GameListResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid search parameters',
    type: ErrorResponseDto,
  })
  @ExcludeTransform()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async searchGames(@Query() searchDto: SearchGamesDto): Promise<GameListResponseDto> {
    const result = await this.searchService.searchGames(searchDto);
    
    // Transform Game entities to GameResponseDto
    const gameResponseDtos = result.games.map(
      (game) => new GameResponseDto(game),
    );

    return new GameListResponseDto(
      gameResponseDtos,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a game by its ID',
    description:
      'Retrieve detailed information about a specific game by its UUID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved game details',
    type: GameResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid game ID format',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found or unavailable',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error',
    type: ErrorResponseDto,
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the game',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Cache('game_{{params.id}}', 1800) // 30 minutes TTL for individual games
  @Timeout(10000) // 10 seconds timeout for single game retrieval
  @ExcludeTransform()
  async getGameById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GameResponseDto> {
    const game = await this.gameService.getGameById(id);
    return new GameResponseDto(game);
  }

  @Get(':id/purchase-info')
  @ApiOperation({
    summary: 'Get game purchase information (For Payment Service)',
    description:
      'Retrieve purchase-specific information for a game, used by Payment Service for order processing',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved purchase information',
    type: PurchaseInfoDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid game ID format',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found or not available for purchase',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error',
    type: ErrorResponseDto,
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the game',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Cache('game_purchase_{{params.id}}', 900) // 15 minutes TTL for purchase info
  @Timeout(8000) // 8 seconds timeout for purchase info (critical for payment flow)
  @ExcludeTransform()
  async getGamePurchaseInfo(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PurchaseInfoDto> {
    return this.gameService.getGamePurchaseInfo(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new game',
    description: 'Create a new game in the catalog (for testing purposes)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Game created successfully',
    type: GameResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid game data',
    type: ErrorResponseDto,
  })
  @ExcludeTransform()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createGame(@Body() createGameDto: CreateGameDto): Promise<GameResponseDto> {
    const game = await this.gameService.createGame(createGameDto);
    return new GameResponseDto(game);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a game',
    description: 'Update an existing game by its UUID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Game updated successfully',
    type: GameResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid game data or ID format',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found',
    type: ErrorResponseDto,
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the game',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ExcludeTransform()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateGame(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateGameDto: UpdateGameDto,
  ): Promise<GameResponseDto> {
    const game = await this.gameService.updateGame(id, updateGameDto);
    return new GameResponseDto(game);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a game',
    description: 'Delete a game by its UUID',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Game deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid game ID format',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Game not found',
    type: ErrorResponseDto,
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the game',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGame(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.gameService.deleteGame(id);
  }
}
