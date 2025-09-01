import { Controller, Get, Param, Patch, Body, Query, ValidationPipe, UsePipes } from '@nestjs/common';
import { GameService } from '../../../application/services/game.service';
import { PaginationDto } from '../dtos/pagination.dto';

// @UseGuards(AdminGuard) // This controller should be protected for admins/moderators
@Controller('moderation')
export class ModerationController {
  constructor(private readonly gameService: GameService) {}

  @Get('queue')
  @UsePipes(new ValidationPipe({ transform: true }))
  getQueue(@Query() paginationDto: PaginationDto) {
    return this.gameService.getModerationQueue(paginationDto);
  }

  @Patch(':id/approve')
  approveGame(@Param('id') id: string) {
    return this.gameService.approveGame(id);
  }

  @Patch(':id/reject')
  rejectGame(@Param('id') id: string, @Body('reason') reason: string) {
    return this.gameService.rejectGame(id, reason);
  }
}
