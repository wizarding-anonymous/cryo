import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiParam 
} from '@nestjs/swagger';
import { ProgressService } from '../services/progress.service';
import { UpdateProgressDto } from '../dto/update-progress.dto';
import { UserProgressResponseDto } from '../dto/user-progress-response.dto';

@Controller('progress')
@ApiTags('progress')
@ApiBearerAuth()
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('user/:userId')
  @ApiOperation({ summary: 'Получить прогресс пользователя' })
  @ApiParam({ name: 'userId', description: 'ID пользователя' })
  @ApiResponse({ 
    status: 200, 
    description: 'Прогресс пользователя по достижениям',
    type: [UserProgressResponseDto]
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserProgress(@Param('userId') userId: string): Promise<UserProgressResponseDto[]> {
    return this.progressService.getUserProgress(userId);
  }

  @Post('update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обновить прогресс' })
  @ApiResponse({ 
    status: 200, 
    description: 'Прогресс успешно обновлен',
    type: [UserProgressResponseDto]
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateProgress(@Body() dto: UpdateProgressDto): Promise<UserProgressResponseDto[]> {
    return this.progressService.updateProgress(dto.userId, dto.eventType, dto.eventData);
  }
}
