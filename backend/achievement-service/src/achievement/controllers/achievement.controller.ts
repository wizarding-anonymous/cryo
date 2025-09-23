import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiParam,
  ApiQuery 
} from '@nestjs/swagger';
import { AchievementService, GetUserAchievementsOptions } from '../services/achievement.service';
import { UnlockAchievementDto } from '../dto/unlock-achievement.dto';
import { AchievementResponseDto, UserAchievementResponseDto, PaginatedUserAchievementsResponseDto } from '../dto';

@Controller('achievements')
@ApiTags('achievements')
@ApiBearerAuth()
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  @Get()
  @ApiOperation({ summary: 'Получить все достижения' })
  @ApiResponse({ 
    status: 200, 
    description: 'Список всех достижений',
    type: [AchievementResponseDto]
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllAchievements(): Promise<AchievementResponseDto[]> {
    return this.achievementService.getAllAchievements();
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Получить достижения пользователя' })
  @ApiParam({ name: 'userId', description: 'ID пользователя' })
  @ApiQuery({ name: 'page', required: false, description: 'Номер страницы', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество элементов на странице', example: 20 })
  @ApiQuery({ name: 'type', required: false, description: 'Тип достижения для фильтрации' })
  @ApiQuery({ name: 'unlocked', required: false, description: 'Фильтр по статусу разблокировки', type: Boolean })
  @ApiResponse({ 
    status: 200, 
    description: 'Список достижений пользователя с пагинацией',
    type: PaginatedUserAchievementsResponseDto
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserAchievements(
    @Param('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
    @Query('unlocked') unlocked?: boolean,
  ): Promise<PaginatedUserAchievementsResponseDto> {
    const options: GetUserAchievementsOptions = {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      type,
      unlocked,
    };
    
    return this.achievementService.getUserAchievements(userId, options);
  }

  @Post('unlock')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Разблокировать достижение' })
  @ApiResponse({ 
    status: 201, 
    description: 'Достижение успешно разблокировано',
    type: UserAchievementResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Achievement not found' })
  @ApiResponse({ status: 409, description: 'Achievement already unlocked' })
  async unlockAchievement(@Body() dto: UnlockAchievementDto): Promise<UserAchievementResponseDto> {
    return this.achievementService.unlockAchievement(dto.userId, dto.achievementId);
  }
}
