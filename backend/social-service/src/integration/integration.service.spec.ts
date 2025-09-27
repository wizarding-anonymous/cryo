import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationService } from './integration.service';
import { Friendship } from '../friends/entities/friendship.entity';
import { FriendshipStatus } from '../friends/entities/friendship-status.enum';
import { AchievementServiceClient } from '../clients/achievement.service.client';
import { NotificationServiceClient } from '../clients/notification.service.client';
import { CacheService } from '../cache/cache.service';

describe('IntegrationService', () => {
  let service: IntegrationService;
  let friendshipRepository: jest.Mocked<Repository<Friendship>>;
  let achievementServiceClient: jest.Mocked<AchievementServiceClient>;
  let notificationServiceClient: jest.Mocked<NotificationServiceClient>;
  let cacheService: jest.Mocked<CacheService>;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockFriendId = '123e4567-e89b-12d3-a456-426614174001';
  const mockTargetUserId = '123e4567-e89b-12d3-a456-426614174002';

  beforeEach(async () => {
    const mockFriendshipRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
    };

    const mockAchievementServiceClient = {
      updateProgress: jest.fn(),
    };

    const mockNotificationServiceClient = {
      sendNotification: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
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
    }).compile();

    service = module.get<IntegrationService>(IntegrationService);
    friendshipRepository = module.get(getRepositoryToken(Friendship));
    achievementServiceClient = module.get(AchievementServiceClient);
    notificationServiceClient = module.get(NotificationServiceClient);
    cacheService = module.get(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getFriendsForAchievements', () => {
    it('should return cached friends list if available', async () => {
      const cachedResponse = {
        userId: mockUserId,
        friendIds: [mockFriendId],
        totalFriends: 1,
        retrievedAt: new Date(),
      };

      cacheService.get.mockResolvedValue(cachedResponse);

      const result = await service.getFriendsForAchievements(mockUserId);

      expect(result).toEqual(cachedResponse);
      expect(cacheService.get).toHaveBeenCalledWith(`integration:achievements:friends:${mockUserId}`);
      expect(friendshipRepository.find).not.toHaveBeenCalled();
    });

    it('should fetch friends from database and cache result', async () => {
      const mockFriendships = [
        {
          id: '1',
          userId: mockUserId,
          friendId: mockFriendId,
          status: FriendshipStatus.ACCEPTED,
          requestedBy: mockUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          userId: mockTargetUserId,
          friendId: mockUserId,
          status: FriendshipStatus.ACCEPTED,
          requestedBy: mockTargetUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      cacheService.get.mockResolvedValue(null);
      friendshipRepository.find.mockResolvedValue(mockFriendships);

      const result = await service.getFriendsForAchievements(mockUserId);

      expect(result.userId).toBe(mockUserId);
      expect(result.friendIds).toEqual([mockFriendId, mockTargetUserId]);
      expect(result.totalFriends).toBe(2);
      expect(cacheService.set).toHaveBeenCalledWith(
        `integration:achievements:friends:${mockUserId}`,
        expect.any(Object),
        300,
      );
    });

    it('should handle empty friends list', async () => {
      cacheService.get.mockResolvedValue(null);
      friendshipRepository.find.mockResolvedValue([]);

      const result = await service.getFriendsForAchievements(mockUserId);

      expect(result.userId).toBe(mockUserId);
      expect(result.friendIds).toEqual([]);
      expect(result.totalFriends).toBe(0);
    });
  });

  describe('checkSocialConnection', () => {
    it('should return none connection for same user', async () => {
      const result = await service.checkSocialConnection(mockUserId, mockUserId);

      expect(result).toEqual({
        userId: mockUserId,
        targetUserId: mockUserId,
        areFriends: false,
        connectionType: 'none',
        metadata: { reason: 'same_user' },
      });
    });

    it('should return cached connection if available', async () => {
      const cachedResponse = {
        userId: mockUserId,
        targetUserId: mockFriendId,
        areFriends: true,
        connectionType: 'friends' as const,
      };

      cacheService.get.mockResolvedValue(cachedResponse);

      const result = await service.checkSocialConnection(mockUserId, mockFriendId);

      expect(result).toEqual(cachedResponse);
      expect(friendshipRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return friends connection for accepted friendship', async () => {
      const mockFriendship = {
        id: '1',
        userId: mockUserId,
        friendId: mockFriendId,
        status: FriendshipStatus.ACCEPTED,
        requestedBy: mockUserId,
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-10'),
      };

      cacheService.get.mockResolvedValue(null);
      friendshipRepository.findOne.mockResolvedValue(mockFriendship);

      const result = await service.checkSocialConnection(mockUserId, mockFriendId);

      expect(result.areFriends).toBe(true);
      expect(result.connectionType).toBe('friends');
      expect(result.friendshipDate).toEqual(mockFriendship.createdAt);
      expect(result.metadata?.requestedBy).toBe(mockUserId);
    });

    it('should return pending connection for pending friendship', async () => {
      const mockFriendship = {
        id: '1',
        userId: mockUserId,
        friendId: mockFriendId,
        status: FriendshipStatus.PENDING,
        requestedBy: mockUserId,
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-10'),
      };

      cacheService.get.mockResolvedValue(null);
      friendshipRepository.findOne.mockResolvedValue(mockFriendship);

      const result = await service.checkSocialConnection(mockUserId, mockFriendId);

      expect(result.areFriends).toBe(false);
      expect(result.connectionType).toBe('pending_request');
      expect(result.metadata?.requestedBy).toBe(mockUserId);
    });

    it('should return none connection when no friendship exists', async () => {
      cacheService.get.mockResolvedValue(null);
      friendshipRepository.findOne.mockResolvedValue(null);

      const result = await service.checkSocialConnection(mockUserId, mockFriendId);

      expect(result.areFriends).toBe(false);
      expect(result.connectionType).toBe('none');
    });
  });

  describe('getMutualFriendsCount', () => {
    it('should return 0 for same user', async () => {
      const result = await service.getMutualFriendsCount(mockUserId, mockUserId);

      expect(result).toEqual({
        mutualFriendsCount: 0,
        userId: mockUserId,
        targetUserId: mockUserId,
      });
    });

    it('should calculate mutual friends correctly', async () => {
      const userFriendships = [
        {
          id: '1',
          userId: mockUserId,
          friendId: mockFriendId,
          status: FriendshipStatus.ACCEPTED,
          requestedBy: mockUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          userId: mockUserId,
          friendId: mockTargetUserId,
          status: FriendshipStatus.ACCEPTED,
          requestedBy: mockUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const targetUserFriendships = [
        {
          id: '3',
          userId: mockTargetUserId,
          friendId: mockFriendId,
          status: FriendshipStatus.ACCEPTED,
          requestedBy: mockTargetUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      cacheService.get.mockResolvedValueOnce(null); // For mutual friends cache
      cacheService.get.mockResolvedValueOnce(null); // For user friends cache
      cacheService.get.mockResolvedValueOnce(null); // For target user friends cache

      friendshipRepository.find
        .mockResolvedValueOnce(userFriendships)
        .mockResolvedValueOnce(targetUserFriendships);

      const result = await service.getMutualFriendsCount(mockUserId, mockTargetUserId);

      expect(result.mutualFriendsCount).toBe(1);
      expect(result.userId).toBe(mockUserId);
      expect(result.targetUserId).toBe(mockTargetUserId);
    });
  });

  describe('notifyFirstFriendAchievement', () => {
    it('should notify achievement service for first friend', async () => {
      friendshipRepository.count.mockResolvedValue(1);

      await service.notifyFirstFriendAchievement(mockUserId, mockFriendId);

      expect(achievementServiceClient.updateProgress).toHaveBeenCalledWith({
        userId: mockUserId,
        eventType: 'friend_added',
        eventData: { friendId: mockFriendId },
      });
    });

    it('should not notify achievement service if not first friend', async () => {
      friendshipRepository.count.mockResolvedValue(2);

      await service.notifyFirstFriendAchievement(mockUserId, mockFriendId);

      expect(achievementServiceClient.updateProgress).not.toHaveBeenCalled();
    });

    it('should handle achievement service errors gracefully', async () => {
      friendshipRepository.count.mockResolvedValue(1);
      achievementServiceClient.updateProgress.mockRejectedValue(new Error('Service unavailable'));

      await expect(service.notifyFirstFriendAchievement(mockUserId, mockFriendId)).resolves.not.toThrow();
    });
  });

  describe('sendFriendRequestNotification', () => {
    it('should send notification when preferences allow', async () => {
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

    it('should handle notification service errors gracefully', async () => {
      notificationServiceClient.sendNotification.mockRejectedValue(new Error('Service unavailable'));

      await expect(
        service.sendFriendRequestNotification(mockUserId, mockFriendId, 'request-123'),
      ).resolves.not.toThrow();
    });
  });

  describe('getNotificationPreferences', () => {
    it('should return default preferences for MVP', async () => {
      const result = await service.getNotificationPreferences(mockUserId);

      expect(result).toEqual({
        userId: mockUserId,
        friendRequestNotifications: true,
        messageNotifications: true,
        achievementNotifications: true,
      });
    });
  });
});