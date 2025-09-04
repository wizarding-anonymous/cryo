import { Controller, Get, Post, Body, Param, Put, Patch, UsePipes, ValidationPipe, Query, UseGuards, Headers } from '@nestjs/common';
import { ApiResponse, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { GameService } from '../../../application/services/game.service';
import { ModerationService } from '../../../application/services/moderation.service';
import { CreateGameDto } from '../dtos/create-game.dto';
import { UpdateGameDto } from '../dtos/update-game.dto';
import { Game } from '../../../domain/entities/game.entity';
import { PaginationDto } from '../dtos/pagination.dto';
import { GameAnalyticsDto } from '../dtos/game-analytics.dto';

// import { JwtAuthGuard } from '../guards/jwt-auth.guard'; // Placeholder for auth guard
// import { DeveloperId } from '../decorators/developer-id.decorator'; // Placeholder for custom decorator to get dev ID

@Controller('developer/games')
// @UseGuards(JwtAuthGuard) // All routes in this controller will be protected
export class DeveloperController {
  constructor(
    private readonly gameService: GameService,
    private readonly moderationService: ModerationService,
    ) {}

  // This would be modified to get games only for the authenticated developer
  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiHeader({
    name: 'Accept-Language',
    description: 'Preferred language(s) for the response',
    required: false,
  })
  findDeveloperGames(
    @Query() paginationDto: PaginationDto,
    @Headers('accept-language') languageHeader: string,
    /*@DeveloperId() developerId: string*/
  ) {
    const developerId = 'mock-dev-id'; // Placeholder
    return this.gameService.findByDeveloper(developerId, paginationDto, languageHeader);
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  createGame(
    @Body() createGameDto: CreateGameDto,
    /*@DeveloperId() developerId: string*/
    ) {
    // In a real app, the developerId would come from the token, not the DTO.
    // We would have to ensure the DTO's developerId matches the token's developerId.
    const developerId = 'mock-dev-id';
    if (createGameDto.developerId !== developerId) {
        // For now, we'll just assign it. In a real app, this would be a ForbiddenException.
        createGameDto.developerId = developerId;
    }
    return this.gameService.create(createGameDto);
  }

  @Put(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  updateGame(
    @Param('id') id: string,
    @Body() updateGameDto: UpdateGameDto,
    /*@DeveloperId() developerId: string*/
  ) {
    const developerId = 'mock-dev-id'; // Placeholder
    // Real app would verify ownership here before calling update
    // e.g. await this.gameService.verifyOwnership(id, developerId);
    return this.gameService.update(id, updateGameDto);
  }

  @Patch(':id/submit')
  submitForModeration(@Param('id') id: string /*@DeveloperId() developerId: string*/) {
    const developerId = 'mock-dev-id'; // Placeholder
    return this.moderationService.submitForModeration(id, developerId);
  }

  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get analytics data for a game' })
  @ApiResponse({ status: 200, description: 'Analytics data for the game.', type: GameAnalyticsDto })
  @ApiResponse({ status: 404, description: 'Game not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  getGameAnalytics(
    @Param('id') id: string,
    /*@DeveloperId() developerId: string*/
  ) {
    const developerId = 'mock-dev-id'; // Placeholder
    return this.gameService.getDeveloperGameAnalytics(id, developerId);
  }
}
