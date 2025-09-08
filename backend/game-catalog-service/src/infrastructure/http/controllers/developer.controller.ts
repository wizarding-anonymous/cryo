import { Controller, Get, Post, Body, Param, Put, Patch, UsePipes, ValidationPipe, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GameService } from '../../../application/services/game.service';
import { VersionService } from '../../../application/services/version.service';
import { RequirementsService } from '../../../application/services/requirements.service';
import { CreateGameDto } from '../dtos/create-game.dto';
import { UpdateGameDto } from '../dtos/update-game.dto';
import { Game } from '../../../domain/entities/game.entity';
import { PaginationDto } from '../dtos/pagination.dto';
import { CreateVersionDto } from '../dtos/create-version.dto';
import { GameVersion } from '../../../domain/entities/game-version.entity';
import { SystemRequirements } from '../../../domain/entities/system-requirements.entity';

// import { JwtAuthGuard } from '../guards/jwt-auth.guard'; // Placeholder for auth guard
// import { DeveloperId } from '../decorators/developer-id.decorator'; // Placeholder for custom decorator to get dev ID

@Controller('developer/games')
// @UseGuards(JwtAuthGuard) // All routes in this controller will be protected
export class DeveloperController {
  constructor(
    private readonly gameService: GameService,
    private readonly versionService: VersionService,
    private readonly requirementsService: RequirementsService,
    ) {}

  // This would be modified to get games only for the authenticated developer
  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  findDeveloperGames(
    @Query() paginationDto: PaginationDto,
    /*@DeveloperId() developerId: string*/
  ) {
    const developerId = 'mock-dev-id'; // Placeholder
    return this.gameService.findByDeveloper(developerId, paginationDto);
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
    return this.gameService.submitForModeration(id, developerId);
  }

  @Post(':id/versions')
  @ApiOperation({ summary: 'Create a new version for a game' })
  @ApiResponse({ status: 201, description: 'The version has been successfully created.', type: GameVersion })
  createVersion(
    @Param('id') id: string,
    @Body() createVersionDto: CreateVersionDto,
    /*@DeveloperId() developerId: string*/
  ): Promise<GameVersion> {
    const developerId = 'mock-dev-id'; // Placeholder
    return this.versionService.createVersion(id, developerId, createVersionDto);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get the version history for a game' })
  @ApiResponse({ status: 200, description: 'A list of game versions.', type: [GameVersion] })
  getVersionHistory(@Param('id') id: string): Promise<GameVersion[]> {
    return this.versionService.getVersionHistory(id);
  }

  @Put(':id/requirements')
  @ApiOperation({ summary: 'Update system requirements for a game' })
  @ApiResponse({ status: 200, description: 'The requirements have been successfully updated.', type: SystemRequirements })
  updateRequirements(
    @Param('id') id: string,
    @Body() requirements: SystemRequirements,
    /*@DeveloperId() developerId: string*/
  ): Promise<SystemRequirements> {
    const developerId = 'mock-dev-id'; // Placeholder
    return this.requirementsService.updateRequirements(id, developerId, requirements);
  }
}
