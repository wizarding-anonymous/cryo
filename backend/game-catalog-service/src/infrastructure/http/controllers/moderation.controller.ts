import { Controller, Get, Param, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GameService } from '../../../application/services/game.service';
import { PaginationDto } from '../dtos/pagination.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RejectGameDto } from '../dtos/reject-game.dto';
import { Game } from 'src/domain/entities/game.entity';

@ApiTags('Moderation')
@Controller('moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'moderator')
@ApiBearerAuth()
export class ModerationController {
  constructor(private readonly gameService: GameService) {}

  @Get('queue')
  @ApiOperation({ summary: 'Get the list of games pending moderation' })
  @ApiResponse({ status: 200, description: 'A paginated list of games pending review.' })
  getQueue(@Query() paginationDto: PaginationDto) {
    return this.gameService.getModerationQueue(paginationDto);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a game submission' })
  @ApiResponse({ status: 200, description: 'The game has been approved and published.', type: Game })
  @ApiResponse({ status: 404, description: 'Game not found.' })
  approveGame(@Param('id') id: string) {
    return this.gameService.approveGame(id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a game submission' })
  @ApiResponse({ status: 200, description: 'The game has been rejected.', type: Game })
  @ApiResponse({ status: 404, description: 'Game not found.' })
  rejectGame(@Param('id') id: string, @Body() rejectGameDto: RejectGameDto) {
    return this.gameService.rejectGame(id, rejectGameDto.reason);
  }
}
