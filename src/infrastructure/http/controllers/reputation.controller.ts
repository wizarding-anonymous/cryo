import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Request 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReputationService } from '../../../application/services/reputation.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { ProcessActivityDto, AdminUpdateReputationDto } from '../dtos/reputation.dto';

@ApiTags('Reputation System')
@Controller('reputation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user reputation score and privileges' })
  @ApiResponse({ status: 200, description: 'Reputation data retrieved successfully' })
  async getMyReputation(@Request() req: any) {
    const privileges = await this.reputationService.getUserReputationPrivileges(req.user.userId);
    const history = await this.reputationService.getReputationHistory(req.user.userId, 10);
    
    return {
      userId: req.user.userId,
      reputationScore: req.user.reputationScore || 0,
      privileges,
      recentHistory: history,
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get reputation history for current user' })
  @ApiResponse({ status: 200, description: 'Reputation history retrieved successfully' })
  async getMyReputationHistory(
    @Request() req: any,
    @Query('limit') limit?: number
  ) {
    return this.reputationService.getReputationHistory(
      req.user.userId, 
      limit ? parseInt(limit.toString()) : 50
    );
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get top reputation users leaderboard' })
  @ApiResponse({ status: 200, description: 'Leaderboard retrieved successfully' })
  async getLeaderboard(@Query('limit') limit?: number) {
    return this.reputationService.getTopReputationUsers(
      limit ? parseInt(limit.toString()) : 10
    );
  }

  @Get('privileges')
  @ApiOperation({ summary: 'Get current user reputation privileges' })
  @ApiResponse({ status: 200, description: 'Privileges retrieved successfully' })
  async getMyPrivileges(@Request() req: any) {
    return this.reputationService.getUserReputationPrivileges(req.user.userId);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get public reputation info for specific user' })
  @ApiResponse({ status: 200, description: 'User reputation retrieved successfully' })
  async getUserReputation(@Param('userId') userId: string) {
    const privileges = await this.reputationService.getUserReputationPrivileges(userId);
    
    // Возвращаем только публичную информацию
    return {
      userId,
      privileges: {
        canModerateComments: privileges.canModerateComments,
        canCreatePolls: privileges.canCreatePolls,
        prioritySupport: privileges.prioritySupport,
      },
    };
  }

  @Post('activity')
  @ApiOperation({ summary: 'Process activity for reputation calculation' })
  @ApiResponse({ status: 200, description: 'Activity processed successfully' })
  async processActivity(
    @Request() req: any,
    @Body() activityData: ProcessActivityDto
  ) {
    await this.reputationService.processActivityReputationUpdate(
      req.user.userId,
      activityData.activity,
      activityData.metadata
    );
    
    return { message: 'Activity processed successfully' };
  }

  // Административные эндпоинты
  @Post('admin/update')
  @ApiOperation({ summary: 'Manually update user reputation (admin only)' })
  @ApiResponse({ status: 200, description: 'Reputation updated successfully' })
  @Roles('admin', 'moderator')
  @UseGuards(RolesGuard)
  async adminUpdateReputation(
    @Body() updateData: AdminUpdateReputationDto
  ) {
    await this.reputationService.updateReputationScore(
      updateData.userId,
      updateData.change,
      updateData.reason,
      'admin_action'
    );
    
    return { message: 'Reputation updated successfully' };
  }

  @Get('admin/history/:userId')
  @ApiOperation({ summary: 'Get full reputation history for user (admin only)' })
  @ApiResponse({ status: 200, description: 'Full history retrieved successfully' })
  @Roles('admin', 'moderator')
  @UseGuards(RolesGuard)
  async getFullUserHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: number
  ) {
    return this.reputationService.getReputationHistory(
      userId,
      limit ? parseInt(limit.toString()) : 100
    );
  }
}