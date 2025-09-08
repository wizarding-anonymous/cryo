import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { GameService } from '../../../application/services/game.service';
import { RequirementsService } from '../../../application/services/requirements.service';
import { Game } from '../../../domain/entities/game.entity';
import { SystemRequirements } from '../../../domain/entities/system-requirements.entity';
import { CreateGameDto } from '../dtos/create-game.dto';
import { UpdateGameDto } from '../dtos/update-game.dto';
import { PaginationDto } from '../dtos/pagination.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { User } from '../../auth/decorators/user.decorator';

@ApiTags('Games')
@Controller('games')
export class GameController {
  constructor(
    private readonly gameService: GameService,
    private readonly requirementsService: RequirementsService,
    ) {}

  @Get()
  @ApiOperation({ summary: 'Get a paginated list of games' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', type: Number })
  @ApiResponse({ status: 200, description: 'A paginated list of games.' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.gameService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single game by ID' })
  @ApiResponse({ status: 200, description: 'The game object.', type: Game })
  @ApiResponse({ status: 404, description: 'Game not found.' })
  findOne(@Param('id') id: string): Promise<Game | null> {
    return this.gameService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('developer', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new game' })
  @ApiResponse({ status: 201, description: 'The game has been successfully created.', type: Game })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  create(@Body() createGameDto: CreateGameDto, @User() user: { id: string }): Promise<Game> {
    // Assuming the user object from the JWT payload has an `id` property
    return this.gameService.create(createGameDto, user.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('developer', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a game' })
  @ApiResponse({ status: 200, description: 'The game has been successfully updated.', type: Game })
  @ApiResponse({ status: 404, description: 'Game not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  update(@Param('id') id: string, @Body() updateGameDto: UpdateGameDto, @User() user: { id:string }): Promise<Game> {
    return this.gameService.update(id, updateGameDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('developer', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a game' })
  @ApiResponse({ status: 204, description: 'The game has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Game not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  remove(@Param('id') id: string, @User() user: { id: string }): Promise<void> {
    return this.gameService.remove(id, user.id);
  }

  @Get(':id/requirements')
  @ApiOperation({ summary: 'Get system requirements for a game' })
  @ApiResponse({ status: 200, description: 'The system requirements.', type: SystemRequirements })
  @ApiResponse({ status: 404, description: 'Game not found.' })
  getRequirements(@Param('id') id: string): Promise<SystemRequirements> {
    return this.requirementsService.getRequirements(id);
  }
}
