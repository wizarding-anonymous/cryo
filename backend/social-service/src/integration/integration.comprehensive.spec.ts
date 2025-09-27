import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { Friendship } from '../friends/entities/friendship.entity';
import { FriendshipStatus } from '../friends/entities/friendship-status.enum';
import { AchievementServiceClient } from '../clients/achievement.service.client';
import { NotificationServiceClient } from '../clients/notification.service.client';
import { CacheService } from '../cache/cache.service';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';

describe('Integration Comprehensive Tests', () => {
  let service: IntegrationService;
  let controller: IntegrationController;
  let friendshipRepository: jest.Mocked<Repository<Friendship>>;
  let achievementServiceClient: jest.Mocked<AchievementServiceClient>;
  let notificationServiceClient: jest.Mocked<NotificationServiceClient>;
  let cacheService: jest.Mocked<CacheService>;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockFriendId = '123e4567-e89b-12d3-a456-426614174001';
  const mockTargetUserId = '123e4567-e89b-12d3-a456-426614174002';
  const mockMutualFriendId = '123e4567-e89b-12d3-a456-426614174003';

  beforeEach(async () => {
    const mockFriendshipRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
    };

    const mockAchievementServiceClient = {
      updateProgress: jest.fn(),
      getUserAchievements: jest.fn(),
    };

    const mockNotificationServiceClient = {
      sendNotification: jest.fn(),
      sendBatchNotifications: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationController],
      providers: [
        IntegrationService,
        {
          provide: getRepositoryToken(Friendship),
          useValue: mockFriendshipRepository,
        },
        {
          provide: AchievementServiceClient,
          useValue: mockAchievementServiceClient,
        },
        {
          provide: NotificationServiceClient,
          useValue: mockNotificationServiceClient,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    })
      .overrideGuard(InternalAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    service = module.get<IntegrationService>(IntegrationService);
    controller = module.get<IntegrationController>(IntegrationController);
    friendshipRepository = module.get(getRepositoryToken(Friendship));
    achievementServiceClient = module.get(AchievementServiceClient);
    notificationServiceClient = module.get(NotificationServiceClient);
    cacheService = module.get(CacheService);
  });

  describe('Achievement Service Integration', () => {
    it('should provide complete friends list for achievement calculations', async () => {
      const mockFriendships = [
        {
          id: '1',
          userId: mockUserId,
          friendId: mockFriendId,
          status: FriendshipStatus.ACCEPTED,
          requestedBy: mockUserId,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          userId: mockTargetUserId,
          friendId: mockUserId,
          status: FriendshipStatus.ACCEPTED,
          requestedBy: mockTargetUserId,
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      cacheService.get.mockResolvedValue(null);
      friendshipRepository.find.mockResolvedValue(mockFriendships);

      const result = await controller.getFriendsForAchievements(mockUserId);

      expect(result).toEqual({
        userId: mockUserId,
        friendIds: [mockFriendId, mockTargetUserId],
        totalFriends: 2,
        retrievedAt: expect.any(Date),
      });

      expect(cacheService.set).toHaveBeenCalledWith(
        `integration:achievements:friends:${mockUserId}`,
        expect.any(Object),
        300,
      );
    });

    it('should handle first friend achievement webhook correctly', async () => {
      friendshipRepository.count.mockResolvedValue(1);

      const webhookDto = {
        userId: mockUserId,
        friendId: mockFriendId,
        timestamp: new Date(),
      };

      await controller.notifyFirstFriendAchievement(webhookDto);

      expect(achievementServiceClient.updateProgress).toHaveBeenCalledWith({
        userId: mockUserId,
        eventType: 'friend_added',
        eventData: { friendId: mockFriendId },
      });
    });

    it('should not trigger first friend achievement for subsequent friends', async () => {
      friendshipRepository.count.mockResolvedValue(3);

      await service.notifyFirstFriendAchievement(mockUserId, mockFriendId);

      expect(achievementServiceClient.updateProgress).not.toHaveBeenCalled();
    });
  });

  describe('Review Service Integration', () => {
    it('should provide accurate social connection information', async () => {
      const mockFriendship = {
        id: '1',
        userId: mockUserId,
        friendId: mockTargetUserId,
        status: FriendshipStatus.ACCEPTED,
        requestedBy: mockUserId,
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-10'),
      };

      cacheService.get.mockResolvedValue(null);
      friendshipRepository.findOne.mockResolvedValue(mockFriendship);

      const result = await controller.checkSocialConnection(mockUserId, mockTargetUserId);

      expect(result).toEqual({
        userId: mockUserId,
        targetUserId: mockTargetUserId,
        areFriends: true,
        friendshipDate: mockFriendship.createdAt,
        connectionType: 'friends',
        metadata: {
          requestedBy: mockUserId,
        },
      });

      expect(cacheService.set).toHaveBeenCalledWith(
        `integration:review:connection:${mockUserId}:${mockTargetUserId}`,
        expect.any(Object),
        120,
      );
    });

    it('should calculate mutual friends count accurately', async () => {
      // Setup: User1 and User2 both have MutualFriend as friend
      const user1Friendships = [
        {
          id: '1',
          userId: mockUserId,
          friendId: mockMutualFriendId,
          status: FriendshipStatus.ACCEPTED,
          requestedBy: mockUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          userId: mockUserId,
          friendId: mockFriendId,
          status: FriendshipStatus.ACCEPTED,
          requestedBy: mockUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const user2Friendships = [
        {
          id: '3',
          userId: mockTargetUserId,
          friendId: mockMutualFriendId,
          status: FriendshipStatus.ACCEPTED,
          requestedBy: mockTargetUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      cacheService.get.mockResolvedValueOnce(null); // For mutual friends cache
      cacheService.get.mockResolvedValueOnce(null); // For user1 friends cache
      cacheService.get.mockResolvedValueOnce(null); // For user2 friends cache

      friendshipRepository.find
        .mockResolvedValueOnce(user1Friendships)
        .mockResolvedValueOnce(user2Friendships);

      const result = await controller.getMutualFriendsCount(mockUserId, mockTargetUserId);

      expect(result).toEqual({
        mutualFriendsCount: 1,
        userId: mockUserId,
        targetUserId: mockTargetUserId,
      });

      expect(cacheService.set).toHaveBeenCalledWith(
        `integration:mutual:${mockUserId}:${mockTargetUserId}`,
        { mutualFriendsCount: 1 },
        600,
      );
    });

    it('should handle pending friend requests in social connections', async () => {
      const mockPendingFriendship = {
        id: '1',
        userId: mockUserId,
        friendId: mockTargetUserId,
        status: FriendshipStatus.PENDING,
        requestedBy: mockUserId,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      };

      cacheService.get.mockResolvedValue(null);
      friendshipRepository.findOne.mockResolvedValue(mockPendingFriendship);

      const result = await controller.checkSocialConnection(mockUserId, mockTargetUserId);

      expect(result).toEqual({
        userId: mockUserId,
        targetUserId: mockTargetUserId,
        areFriends: false,
        connectionType: 'pending_request',
        metadata: {
          requestedBy: mockUserId,
          pendingSince: mockPendingFriendship.createdAt,
        },
      });
    });
  });

  describe('Notification Service Integration', () => {
    it('should send friend request notifications with proper metadata', async () => {
      const mockRequestId = 'request-123';

      await service.sendFriendRequestNotification(mockUserId, mockFriendId, mockRequestId);

      expect(notificationServiceClient.sendNotification).toHaveBeenCalledWith({
        userId: mockFriendId,
        type: 'friend_request',
        title: 'New Friend Request',
        message: 'You have a new friend request',
        metadata: {
          fromUserId: mockUserId,
          requestId: mockRequestId,
          actionUrl: `/friends/requests/${mockRequestId}`,
        },
      });
    });

    it('should send friend request accepted notifications', async () => {
      await service.sendFriendRequestAcceptedNotification(mockUserId, mockFriendId);

      expect(notificationServiceClient.sendNotification).toHaveBeenCalledWith({
        userId: mockFriendId,
        type: 'friend_request',
        title: 'Friend Request Accepted',
        message: 'Your friend request has been accepted',
        metadata: {
          acceptedByUserId: mockUserId,
          actionUrl: '/friends',
        },
      });
    });

    it('should provide notification preferences for social events', async () => {
      const result = await controller.getNotificationPreferences(mockUserId);

      expect(result).toEqual({
        userId: mockUserId,
        friendRequestNotifications: true,
        messageNotifications: true,
        achievementNotifications: true,
      });
    });

    it('should handle notification service failures gracefully', async () => {
      notificationServiceClient.sendNotification.mockRejectedValue(new Error('Service unavailable'));

      // Should not throw error
      await expect(
        service.sendFriendRequestNotification(mockUserId, mockFriendId, 'request-123'),
      ).resolves.not.toThrow();
    });
  });

  describe('Cross-Service Integration Scenarios', () => {
    it('should handle complete friend addition workflow with all integrations', async () => {
      // Simulate first friend scenario
      friendshipRepository.count.mockResolvedValue(1);

      // Test achievement notification
      await service.notifyFirstFriendAchievement(mockUserId, mockFriendId);

      // Test friend request notification
      await service.sendFriendRequestNotification(mockFriendId, mockUserId, 'request-123');

      // Test friend acceptance notification
      await service.sendFriendRequestAcceptedNotification(mockUserId, mockFriendId);

      expect(achievementServiceClient.updateProgress).toHaveBeenCalledWith({
        userId: mockUserId,
        eventType: 'friend_added',
        eventData: { friendId: mockFriendId },
      });

      expect(notificationServiceClient.sendNotification).toHaveBeenCalledTimes(2);
    });

    it('should provide consistent data across all integration endpoints', async () => {
      const mockFriendships = [
        {
          id: '1',
          userId: mockUserId,
          friendId: mockFriendId,
          status: FriendshipStatus.ACCEPTED,
          requestedBy: mockUserId,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      cacheService.get.mockResolvedValue(null);
      friendshipRepository.find.mockResolvedValue(mockFriendships);
      friendshipRepository.findOne.mockResolvedValue(mockFriendships[0] || null);

      // Get friends for achievements
      const friendsResult = await controller.getFriendsForAchievements(mockUserId);

      // Check social connection
      const connectionResult = await controller.checkSocialConnection(mockUserId, mockFriendId);

      // Verify consistency
      expect(friendsResult.friendIds).toContain(mockFriendId);
      expect(connectionResult.areFriends).toBe(true);
      expect(connectionResult.connectionType).toBe('friends');
    });

    it('should handle service failures gracefully without breaking main functionality', async () => {
      // Mock service failures
      achievementServiceClient.updateProgress.mockRejectedValue(new Error('Achievement service down'));
      notificationServiceClient.sendNotification.mockRejectedValue(new Error('Notification service down'));

      // These should not throw errors
      await expect(service.notifyFirstFriendAchievement(mockUserId, mockFriendId)).resolves.not.toThrow();
      await expect(
        service.sendFriendRequestNotification(mockUserId, mockFriendId, 'request-123'),
      ).resolves.not.toThrow();
    });
  });

  describe('Caching Integration', () => {
    it('should use cache effectively across all integration endpoints', async () => {
      const cachedFriendsData = {
        userId: mockUserId,
        friendIds: [mockFriendId],
        totalFriends: 1,
        retrievedAt: new Date(),
      };

      const cachedConnectionData = {
        userId: mockUserId,
        targetUserId: mockFriendId,
        areFriends: true,
        connectionType: 'friends' as const,
      };

      cacheService.get
        .mockResolvedValueOnce(cachedFriendsData)
        .mockResolvedValueOnce(cachedConnectionData);

      // Both calls should use cache
      const friendsResult = await controller.getFriendsForAchievements(mockUserId);
      const connectionResult = await controller.checkSocialConnection(mockUserId, mockFriendId);

      expect(friendsResult).toEqual(cachedFriendsData);
      expect(connectionResult).toEqual(cachedConnectionData);

      // Database should not be called
      expect(friendshipRepository.find).not.toHaveBeenCalled();
      expect(friendshipRepository.findOne).not.toHaveBeenCalled();
    });
  });
});