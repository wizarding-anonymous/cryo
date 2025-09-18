import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AchievementService } from '../services/achievement.service';
import { UnlockAchievementDto } from '../dto/unlock-achievement.dto';

@Controller('achievements')
@ApiTags('achievements')
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  @Get()
  @ApiOperation({ summary: 'Получить все достижения' })
  async getAllAchievements() {
    return this.achievementService.getAllAchievements();
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Получить достижения пользователя' })
  async getUserAchievements(@Param('userId') userId: string) {
    return this.achievementService.getUserAchievements(userId);
  }

  @Post('unlock')
  @ApiOperation({ summary: 'Разблокировать достижение' })
  async unlockAchievement(@Body() dto: UnlockAchievementDto) {
    return this.achievementService.unlockAchievement(dto.userId, dto.achievementId);
  }
}
