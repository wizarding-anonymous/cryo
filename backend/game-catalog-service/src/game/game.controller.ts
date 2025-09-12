import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { GameService } from './game.service';
import { CreateGameDto } from '../dto/create-game.dto';
import { UpdateGameDto } from '../dto/update-game.dto';
import { GetGamesDto } from '../dto/get-games.dto';
import { HttpCacheInterceptor } from '../common/interceptors/http-cache.interceptor';
import {
  Cache,
  InvalidateCache,
} from '../common/decorators/cache.decorator';
import { Game } from '../entities/game.entity';

@ApiTags('Games')
@Controller('games')
@UseInterceptors(HttpCacheInterceptor)
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new game' })
  @ApiResponse({ status: 201, description: 'The game has been successfully created.', type: Game })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  create(@Body() createGameDto: CreateGameDto) {
    return this.gameService.createGame(createGameDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get a paginated list of games' })
  @ApiResponse({ status: 200, description: 'List of games.', type: [Game] })
  findAll(@Query() getGamesDto: GetGamesDto) {
    return this.gameService.getAllGames(getGamesDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a game by its ID' })
  @ApiResponse({ status: 200, description: 'The found game record.', type: Game })
  @ApiResponse({ status: 404, description: 'Game not found.' })
  @ApiParam({ name: 'id', description: 'UUID of the game' })
  @Cache('game_{{params.id}}')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameService.getGameById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a game by its ID' })
  @ApiResponse({ status: 200, description: 'The updated game record.', type: Game })
  @ApiResponse({ status: 404, description: 'Game not found.' })
  @InvalidateCache('game_{{params.id}}')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateGameDto: UpdateGameDto,
  ) {
    return this.gameService.updateGame(id, updateGameDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a game by its ID' })
  @ApiResponse({ status: 204, description: 'The game has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Game not found.' })
  @InvalidateCache('game_{{params.id}}')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameService.deleteGame(id);
  }
}
