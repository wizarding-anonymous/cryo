import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friendship } from '../friends/entities/friendship.entity';
import { FriendshipStatus } from '../friends/entities/friendship-status.enum';
import { AchievementServiceClient } from '../clients/achievement.service.client';
import { NotificationServiceClient } from '../clients/notification.service.client';
import { CacheService } from '../cache/cache.service';
import { FriendsListResponseDto } from './dto/friends-list-response.dto';
import { SocialConnectionCheckDto } from './dto/social-connection-check.dto';

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
    private readonly achievementServiceClient: AchievementServiceClient,
    private readonly notificationServiceClient: NotificationServiceClient,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get friends list for Achievement Service
   */
  async getFriendsForAchievements(userId: string): Promise<FriendsListResponseDto> {
    this.logger.debug(`Getting friends list for achievements for user ${userId}`);

    // Check cache first
    const cacheKey = `integration:achievements:friends:${userId}`;
    const cached = await this.cacheService.get<FriendsListResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Returning cached friends list for user ${userId}`);
      return cached;
    }

    // Get friends from database
    const friendships = await this.friendshipRepository.find({
      where: [
        { userId, status: FriendshipStatus.ACCEPTED },
        { friendId: userId, status: FriendshipStatus.ACCEPTED },
      ],
    });

    // Extract unique friend IDs
    const friendIds = Array.from(
      new Set(
        friendships.map((friendship) =>
          friendship.userId === userId ? friendship.friendId : friendship.userId,
        ),
      ),
    );

    const response: FriendsListResponseDto = {
      userId,
      friendIds,
      totalFriends: friendIds.length,
      retrievedAt: new Date(),
    };

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, response, 300);

    this.logger.debug(`Retrieved ${friendIds.length} friends for user ${userId}`);
    return response;
  }

  /**
   * Check social connection between two users for Review Service
   */
  async checkSocialConnection(userId: string, targetUserId: string): Promise<SocialConnectionCheckDto> {
    this.logger.debug(`Checking social connection between ${userId} and ${targetUserId}`);

    if (userId === targetUserId) {
      return {
        userId,
        targetUserId,
        areFriends: false,
        connectionType: 'none',
        metadata: { reason: 'same_user' },
      };
    }

    // Check cache first
    const cacheKey = `integration:review:connection:${userId}:${targetUserId}`;
    const cached = await this.cacheService.get<SocialConnectionCheckDto>(cacheKey);
    if (cached) {
      return cached;
    }

    // Find friendship
    const friendship = await this.friendshipRepository.findOne({
      where: [
        { userId, friendId: targetUserId },
        { userId: targetUserId, friendId: userId },
      ],
    });

    let response: SocialConnectionCheckDto;

    if (!friendship) {
      response = {
        userId,
        targetUserId,
        areFriends: false,
        connectionType: 'none',
      };
    } else if (friendship.status === FriendshipStatus.ACCEPTED) {
      response = {
        userId,
        targetUserId,
        areFriends: true,
        friendshipDate: friendship.createdAt,
        connectionType: 'friends',
        metadata: {
          requestedBy: friendship.requestedBy,
        },
      };
    } else if (friendship.status === FriendshipStatus.PENDING) {
      response = {
        userId,
        targetUserId,
        areFriends: false,
        connectionType: 'pending_request',
        metadata: {
          requestedBy: friendship.requestedBy,
          pendingSince: friendship.createdAt,
        },
      };
    } else {
      response = {
        userId,
        targetUserId,
        areFriends: false,
        connectionType: 'none',
        metadata: {
          previousStatus: friendship.status,
        },
      };
    }

    // Cache for 2 minutes (shorter cache for connection checks)
    await this.cacheService.set(cacheKey, response, 120);

    return response;
  }

  /**
   * Get mutual friends count between two users
   */
  async getMutualFriendsCount(
    userId: string,
    targetUserId: string,
  ): Promise<{ mutualFriendsCount: number; userId: string; targetUserId: string }> {
    this.logger.debug(`Getting mutual friends count between ${userId} and ${targetUserId}`);

    if (userId === targetUserId) {
      return { mutualFriendsCount: 0, userId, targetUserId };
    }

    // Check cache first
    const cacheKey = `integration:mutual:${userId}:${targetUserId}`;
    const cached = await this.cacheService.get<{ mutualFriendsCount: number }>(cacheKey);
    if (cached) {
      return { ...cached, userId, targetUserId };
    }

    // Get friends for both users
    const [userFriends, targetUserFriends] = await Promise.all([
      this.getFriendsForAchievements(userId),
      this.getFriendsForAchievements(targetUserId),
    ]);

    // Find mutual friends
    const userFriendsSet = new Set(userFriends.friendIds);
    const mutualFriends = targetUserFriends.friendIds.filter((friendId) =>
      userFriendsSet.has(friendId),
    );

    const result = {
      mutualFriendsCount: mutualFriends.length,
      userId,
      targetUserId,
    };

    // Cache for 10 minutes
    await this.cacheService.set(cacheKey, { mutualFriendsCount: mutualFriends.length }, 600);

    return result;
  }

  /**
   * Notify Achievement Service about first friend
   */
  async notifyFirstFriendAchievement(userId: string, friendId: string): Promise<void> {
    this.logger.debug(`Notifying Achievement Service about first friend for user ${userId}`);

    try {
      // Check if this is actually the first friend
      const friendsCount = await this.friendshipRepository.count({
        where: { userId, status: FriendshipStatus.ACCEPTED },
      });

      if (friendsCount === 1) {
        // This is the first friend, notify Achievement Service
        await this.achievementServiceClient.updateProgress({
          userId,
          eventType: 'friend_added',
          eventData: { friendId },
        });

        this.logger.log(`First friend achievement triggered for user ${userId}`);
      } else {
        this.logger.debug(`User ${userId} already has ${friendsCount} friends, not first friend`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to notify Achievement Service about first friend for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Get notification preferences for social events
   */
  async getNotificationPreferences(userId: string): Promise<{
    userId: string;
    friendRequestNotifications: boolean;
    messageNotifications: boolean;
    achievementNotifications: boolean;
  }> {
    this.logger.debug(`Getting notification preferences for user ${userId}`);

    // For MVP, return default preferences
    // In a real implementation, this would fetch from user preferences service
    return {
      userId,
      friendRequestNotifications: true,
      messageNotifications: true,
      achievementNotifications: true,
    };
  }

  /**
   * Send notification about friend request (enhanced integration)
   */
  async sendFriendRequestNotification(
    fromUserId: string,
    toUserId: string,
    requestId: string,
  ): Promise<void> {
    this.logger.debug(`Sending friend request notification from ${fromUserId} to ${toUserId}`);

    try {
      // Check notification preferences first
      const preferences = await this.getNotificationPreferences(toUserId);

      if (preferences.friendRequestNotifications) {
        await this.notificationServiceClient.sendNotification({
          userId: toUserId,
          type: 'friend_request',
          title: 'New Friend Request',
          message: `You have a new friend request`,
          metadata: {
            fromUserId,
            requestId,
            actionUrl: `/friends/requests/${requestId}`,
          },
        });

        this.logger.debug(`Friend request notification sent to user ${toUserId}`);
      } else {
        this.logger.debug(`Friend request notifications disabled for user ${toUserId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send friend request notification to user ${toUserId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Send notification about friend request acceptance
   */
  async sendFriendRequestAcceptedNotification(
    acceptedByUserId: string,
    originalRequesterId: string,
  ): Promise<void> {
    this.logger.debug(
      `Sending friend request accepted notification from ${acceptedByUserId} to ${originalRequesterId}`,
    );

    try {
      const preferences = await this.getNotificationPreferences(originalRequesterId);

      if (preferences.friendRequestNotifications) {
        await this.notificationServiceClient.sendNotification({
          userId: originalRequesterId,
          type: 'friend_request',
          title: 'Friend Request Accepted',
          message: `Your friend request has been accepted`,
          metadata: {
            acceptedByUserId,
            actionUrl: `/friends`,
          },
        });

        this.logger.debug(`Friend request accepted notification sent to user ${originalRequesterId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send friend request accepted notification to user ${originalRequesterId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}