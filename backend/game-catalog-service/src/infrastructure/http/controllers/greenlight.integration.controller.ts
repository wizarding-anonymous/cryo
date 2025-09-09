import { Controller, Post, Body, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GameService } from '../../../application/services/game.service';
import { CreateGameDto } from '../dtos/create-game.dto';
import { Game } from '../../../domain/entities/game.entity';

// import { InternalServiceGuard } from '../guards/internal-service.guard'; // Placeholder for a guard that checks for a service-to-service auth token/API key

@ApiTags('Integrations')
@Controller('integration/greenlight')
// @UseGuards(InternalServiceGuard) // Protect this endpoint to be called only by other internal services
export class GreenlightIntegrationController {
  constructor(private readonly gameService: GameService) {}

  @Post('approve-game')
  @ApiOperation({ summary: 'Creates a new game entry from an approved Greenlight submission.' })
  @ApiResponse({ status: 201, description: 'The game has been successfully created in the catalog.', type: Game })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Invalid or missing service token.' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  createGameFromGreenlight(@Body() createGameDto: CreateGameDto): Promise<Game> {
    // In a real scenario, we might have a specific DTO for this endpoint,
    // but for now, CreateGameDto is sufficient.
    // The `create` service method would also need to be adapted to not require a user context,
    // or to accept a 'system' user. For now, we'll pass a placeholder.
    const systemUserId = 'greenlight-service-user';
    return this.gameService.create(createGameDto, systemUserId);
  }
}
