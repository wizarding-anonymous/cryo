import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProgressService } from '../services/progress.service';
import { UpdateProgressDto } from '../dto/update-progress.dto';

@Controller('progress')
@ApiTags('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('user/:userId')
  @ApiOperation({ summary: 'Получить прогресс пользователя' })
  async getUserProgress(@Param('userId') userId: string) {
    return this.progressService.getUserProgress(userId);
  }

  @Post('update')
  @ApiOperation({ summary: 'Обновить прогресс' })
  async updateProgress(@Body() dto: UpdateProgressDto) {
    return this.progressService.updateProgress(dto.userId, dto.eventType, dto.eventData);
  }
}
