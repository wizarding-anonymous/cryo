import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReputationService, ReputationChange } from '../../../application/services/reputation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('reputation')
@Controller('reputation')
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  @Get('user/:userId')
  @ApiOperation({ summary: 'Получить репутацию пользователя' })
  @ApiResponse({ status: 200, description: 'Репутация пользователя' })
  async getUserReputation(@Param('userId') userId: string) {
    const reputation = await this.reputationService.getUserReputation(userId);
    const privileges = await this.reputationService.getUserPrivileges(userId);

    return {
      userId,
      reputation,
      privileges,
    };
  }

  @Get('user/:userId/history')
  @ApiOperation({ summary: 'Получить историю репутации пользователя' })
  @ApiResponse({ status: 200, description: 'История изменений репутации' })
  async getReputationHistory(@Param('userId') userId: string, @Query('limit') limit?: number) {
    return this.reputationService.getReputationHistory(userId, limit);
  }

  @Get('user/:userId/stats')
  @ApiOperation({ summary: 'Получить статистику репутации за период' })
  @ApiResponse({ status: 200, description: 'Статистика репутации' })
  async getReputationStats(@Param('userId') userId: string, @Query('days') days?: number) {
    return this.reputationService.getReputationStats(userId, days);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Получить топ пользователей по репутации' })
  @ApiResponse({ status: 200, description: 'Список топ пользователей' })
  async getLeaderboard(@Query('limit') limit?: number) {
    return this.reputationService.getTopUsers(limit);
  }

  @Post('award')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Начислить репутацию за активность' })
  @ApiResponse({ status: 200, description: 'Репутация начислена' })
  async awardReputation(@Request() req, @Body() body: { activityType: string; metadata?: any }) {
    await this.reputationService.awardForActivity(req.user.userId, body.activityType, body.metadata);

    return { message: 'Reputation awarded successfully' };
  }

  @Post('update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'moderator')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновить репутацию пользователя (только админы)' })
  @ApiResponse({ status: 200, description: 'Репутация обновлена' })
  async updateReputation(@Body() reputationChange: ReputationChange) {
    await this.reputationService.updateReputation(reputationChange);
    return { message: 'Reputation updated successfully' };
  }

  @Post('penalize')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'moderator')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Наказать пользователя снижением репутации' })
  @ApiResponse({ status: 200, description: 'Наказание применено' })
  async penalizeUser(@Body() body: { userId: string; violationType: string; severity: 'minor' | 'major' | 'severe' }) {
    await this.reputationService.penalizeForViolation(body.userId, body.violationType, body.severity);

    return { message: 'Penalty applied successfully' };
  }
}
