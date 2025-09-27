import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';
import { IntegrationService } from './integration.service';
import { FriendsListResponseDto } from './dto/friends-list-response.dto';
import { SocialConnectionCheckDto } from './dto/social-connection-check.dto';
import { FirstFriendWebhookDto } from './dto/first-friend-webhook.dto';

@ApiTags('Integration')
@Controller('integration')
@UseGuards(InternalAuthGuard)
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  /**
   * Achievement Service Integration - Get friends list for achievements
   */
  @Get('achievement/:userId/friends')
  @ApiOperation({
    summary: 'Get friends list for Achievement Service',
    description: 'Returns list of friend IDs for achievement calculations',
  })
  @ApiParam({ name: 'userId', description: 'User ID to get friends for' })
  @ApiOkResponse({ type: FriendsListResponseDto })
  async getFriendsForAchievements(@Param('userId') userId: string): Promise<FriendsListResponseDto> {
    return this.integrationService.getFriendsForAchievements(userId);
  }

  /**
   * Achievement Service Integration - First friend webhook
   */
  @Post('achievement/webhook/first-friend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Webhook for first friend achievement',
    description: 'Notifies Achievement Service when user adds their first friend',
  })
  @ApiBody({ type: FirstFriendWebhookDto })
  @ApiNoContentResponse()
  async notifyFirstFriendAchievement(@Body() dto: FirstFriendWebhookDto): Promise<void> {
    await this.integrationService.notifyFirstFriendAchievement(dto.userId, dto.friendId);
  }

  /**
   * Review Service Integration - Check social connections
   */
  @Get('review/:userId/connections/:targetUserId')
  @ApiOperation({
    summary: 'Check social connection for Review Service',
    description: 'Checks if two users are friends for review validation',
  })
  @ApiParam({ name: 'userId', description: 'First user ID' })
  @ApiParam({ name: 'targetUserId', description: 'Second user ID' })
  @ApiOkResponse({ type: SocialConnectionCheckDto })
  async checkSocialConnection(
    @Param('userId') userId: string,
    @Param('targetUserId') targetUserId: string,
  ): Promise<SocialConnectionCheckDto> {
    return this.integrationService.checkSocialConnection(userId, targetUserId);
  }

  /**
   * Review Service Integration - Get mutual friends count
   */
  @Get('review/:userId/mutual-friends/:targetUserId')
  @ApiOperation({
    summary: 'Get mutual friends count for Review Service',
    description: 'Returns count of mutual friends between two users',
  })
  @ApiParam({ name: 'userId', description: 'First user ID' })
  @ApiParam({ name: 'targetUserId', description: 'Second user ID' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        mutualFriendsCount: { type: 'number' },
        userId: { type: 'string' },
        targetUserId: { type: 'string' },
      },
    },
  })
  async getMutualFriendsCount(
    @Param('userId') userId: string,
    @Param('targetUserId') targetUserId: string,
  ): Promise<{ mutualFriendsCount: number; userId: string; targetUserId: string }> {
    return this.integrationService.getMutualFriendsCount(userId, targetUserId);
  }

  /**
   * Notification Service Integration - Get notification preferences
   */
  @Get('notification/:userId/preferences')
  @ApiOperation({
    summary: 'Get user notification preferences for social events',
    description: 'Returns user preferences for friend requests and messages',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        friendRequestNotifications: { type: 'boolean' },
        messageNotifications: { type: 'boolean' },
        achievementNotifications: { type: 'boolean' },
      },
    },
  })
  async getNotificationPreferences(@Param('userId') userId: string): Promise<{
    userId: string;
    friendRequestNotifications: boolean;
    messageNotifications: boolean;
    achievementNotifications: boolean;
  }> {
    return this.integrationService.getNotificationPreferences(userId);
  }
}