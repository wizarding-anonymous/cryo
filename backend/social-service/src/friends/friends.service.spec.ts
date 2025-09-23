import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FriendsService } from './friends.service';
import { Friendship } from './entities/friendship.entity';
import { Repository } from 'typeorm';
import { FriendshipStatus } from './entities/friendship-status.enum';
import { AlreadyFriendsException } from '../common/exceptions/already-friends.exception';
import { UserServiceClient } from '../clients/user.service.client';
import { NotificationServiceClient } from '../clients/notification.service.client';
import { AchievementServiceClient } from '../clients/achievement.service.client';
import { CacheService } from '../cache/cache.service';

// Mock query builder
const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

// Mock repository
const mockFriendshipRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(() => mockQueryBuilder),
  remove: jest.fn(),
  findOneBy: jest.fn(),
  count: jest.fn(),
};

// Mock clients
const mockUserServiceClient = {
  getUsersByIds: jest.fn(),
  checkUserExists: jest.fn(),
  searchUsers: jest.fn(),
};

const mockNotificationServiceClient = {
  sendNotification: jest.fn(),
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  invalidateUserCache: jest.fn(),
};

describe('FriendsService', () => {
  let service: FriendsService;
  let repository: Repository<Friendship>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendsService,
        {
          provide: getRepositoryToken(Friendship),
          useValue: mockFriendshipRepository,
        },
        {
          provide: UserServiceClient,
          useValue: mockUserServiceClient,
        },
        {
          provide: NotificationServiceClient,
          useValue: mockNotificationServiceClient,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: AchievementServiceClient,
          useValue: {
            updateProgress: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FriendsService>(FriendsService);
    repository = module.get<Repository<Friendship>>(getRepositoryToken(Friendship));
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendFriendRequest', () => {
    it('should throw an error if sending a request to oneself', async () => {
      await expect(service.sendFriendRequest('user1', 'user1')).rejects.toThrow(
        'Cannot send a friend request to yourself.',
      );
    });

    it('should throw an error if already friends', async () => {
      mockUserServiceClient.checkUserExists.mockResolvedValue(true);
      mockFriendshipRepository.findOne.mockResolvedValue({
        status: FriendshipStatus.ACCEPTED,
      });
      await expect(service.sendFriendRequest('user1', 'user2')).rejects.toThrow(
        AlreadyFriendsException,
      );
    });

    it('should throw an error if request is already pending', async () => {
      mockUserServiceClient.checkUserExists.mockResolvedValue(true);
      mockFriendshipRepository.findOne.mockResolvedValue({
        status: FriendshipStatus.PENDING,
      });
      await expect(service.sendFriendRequest('user1', 'user2')).rejects.toThrow(
        'A friend request is already pending.',
      );
    });

    it('should send a friend request successfully', async () => {
      const fromUserId = 'user1';
      const toUserId = 'user2';
      const newRequest = {
        id: 'req1',
        userId: fromUserId,
        friendId: toUserId,
        status: FriendshipStatus.PENDING,
        requestedBy: fromUserId,
        createdAt: new Date(),
      };

      mockUserServiceClient.checkUserExists.mockResolvedValue(true);
      mockFriendshipRepository.findOne.mockResolvedValue(null);
      mockFriendshipRepository.create.mockReturnValue(newRequest);
      mockFriendshipRepository.save.mockResolvedValue(newRequest);
      mockNotificationServiceClient.sendNotification.mockResolvedValue(undefined);
      mockCacheService.invalidateUserCache.mockResolvedValue(undefined);
      mockUserServiceClient.getUsersByIds.mockResolvedValue([{ id: toUserId, username: 'friend' }]);

      const result = await service.sendFriendRequest(fromUserId, toUserId);
      expect(result.id).toEqual(newRequest.id);
      expect(result.status).toEqual(FriendshipStatus.PENDING);
      expect(mockFriendshipRepository.create).toHaveBeenCalledWith({
        userId: fromUserId,
        friendId: toUserId,
        status: FriendshipStatus.PENDING,
        requestedBy: fromUserId,
      });
      expect(mockFriendshipRepository.save).toHaveBeenCalledWith(newRequest);
      expect(mockNotificationServiceClient.sendNotification).toHaveBeenCalled();
      expect(mockCacheService.invalidateUserCache).toHaveBeenCalledWith(fromUserId);
      expect(mockCacheService.invalidateUserCache).toHaveBeenCalledWith(toUserId);
    });
  });

  describe('acceptFriendRequest', () => {
    it('should accept a friend request successfully', async () => {
      const requestId = 'req1';
      const userId = 'user2';
      const request = {
        id: requestId,
        userId: 'user1',
        friendId: userId,
        status: FriendshipStatus.PENDING,
        requestedBy: 'user1',
        createdAt: new Date(),
      };

      const updatedRequest = { ...request, status: FriendshipStatus.ACCEPTED };

      mockFriendshipRepository.findOne.mockResolvedValue(request);
      mockFriendshipRepository.save.mockResolvedValue(updatedRequest);
      mockNotificationServiceClient.sendNotification.mockResolvedValue(undefined);
      mockCacheService.invalidateUserCache.mockResolvedValue(undefined);
      mockUserServiceClient.getUsersByIds.mockResolvedValue([
        { id: request.userId, username: 'requester' },
      ]);

      const result = await service.acceptFriendRequest(requestId, userId);

      expect(result.status).toEqual(FriendshipStatus.ACCEPTED);
      expect(mockFriendshipRepository.save).toHaveBeenCalled();
      expect(mockNotificationServiceClient.sendNotification).toHaveBeenCalled();
      expect(mockCacheService.invalidateUserCache).toHaveBeenCalledWith(request.userId);
      expect(mockCacheService.invalidateUserCache).toHaveBeenCalledWith(request.friendId);
    });
  });

  describe('declineFriendRequest', () => {
    it('should decline a friend request successfully', async () => {
      const requestId = 'req1';
      const userId = 'user2';
      const request = {
        id: requestId,
        userId: 'user1',
        friendId: userId,
        status: FriendshipStatus.PENDING,
      };

      const updatedRequest = { ...request, status: FriendshipStatus.DECLINED };

      mockFriendshipRepository.findOne.mockResolvedValue(request);
      mockFriendshipRepository.save.mockResolvedValue(updatedRequest);
      mockCacheService.invalidateUserCache.mockResolvedValue(undefined);

      await service.declineFriendRequest(requestId, userId);

      expect(mockFriendshipRepository.save).toHaveBeenCalledWith(updatedRequest);
      expect(mockCacheService.invalidateUserCache).toHaveBeenCalledWith(request.userId);
      expect(mockCacheService.invalidateUserCache).toHaveBeenCalledWith(request.friendId);
    });
  });

  describe('removeFriend', () => {
    it('should remove a friend successfully', async () => {
      const userId = 'user1';
      const friendId = 'user2';
      const friendship = {
        userId,
        friendId,
        status: FriendshipStatus.ACCEPTED,
      };

      mockFriendshipRepository.findOne.mockResolvedValue(friendship);
      mockFriendshipRepository.remove.mockResolvedValue(friendship);
      mockCacheService.invalidateUserCache.mockResolvedValue(undefined);

      await service.removeFriend(userId, friendId);

      expect(mockFriendshipRepository.remove).toHaveBeenCalledWith(friendship);
      expect(mockCacheService.invalidateUserCache).toHaveBeenCalledWith(userId);
      expect(mockCacheService.invalidateUserCache).toHaveBeenCalledWith(friendId);
    });
  });

  describe('getFriends', () => {
    it('should return a paginated list of friends', async () => {
      const userId = 'user1';
      const friends = [
        {
          id: 'friendship1',
          userId,
          friendId: 'user2',
          status: FriendshipStatus.ACCEPTED,
          createdAt: new Date(),
        },
      ];
      const total = 1;
      const friendsInfo = [
        { id: 'user2', username: 'friend1', onlineStatus: 'online', lastSeen: new Date() },
      ];

      mockCacheService.get.mockResolvedValue(null); // No cache
      mockQueryBuilder.getManyAndCount.mockResolvedValue([friends, total]);
      mockUserServiceClient.getUsersByIds.mockResolvedValue(friendsInfo);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getFriends(userId, { page: 1, limit: 10 });

      expect(result.friends).toHaveLength(1);
      expect(result.pagination.total).toEqual(total);
      expect(mockUserServiceClient.getUsersByIds).toHaveBeenCalledWith(['user2']);
    });
  });

  describe('checkFriendship', () => {
    it('should return true if users are friends', async () => {
      mockFriendshipRepository.findOne.mockResolvedValue({
        status: FriendshipStatus.ACCEPTED,
      });
      const result = await service.checkFriendship('user1', 'user2');
      expect(result).toBe(true);
    });

    it('should return false if users are not friends', async () => {
      mockFriendshipRepository.findOne.mockResolvedValue(null);
      const result = await service.checkFriendship('user1', 'user2');
      expect(result).toBe(false);
    });
  });

  describe('getFriendRequests', () => {
    it('should return pending friend requests', async () => {
      const userId = 'user1';
      const requests = [
        {
          id: 'req1',
          userId: 'user2',
          friendId: userId,
          status: FriendshipStatus.PENDING,
          createdAt: new Date(),
        },
      ];
      const requestersInfo = [
        { id: 'user2', username: 'requester1', onlineStatus: 'online', lastSeen: new Date() },
      ];

      mockFriendshipRepository.find.mockResolvedValue(requests);
      mockUserServiceClient.getUsersByIds.mockResolvedValue(requestersInfo);

      const result = await service.getFriendRequests(userId);

      expect(result).toHaveLength(1);
      expect(result[0]?.friendInfo?.username).toEqual('requester1');
      expect(mockFriendshipRepository.find).toHaveBeenCalledWith({
        where: { friendId: userId, status: FriendshipStatus.PENDING },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('searchUsers', () => {
    it('should search users successfully', async () => {
      const query = 'john';
      const currentUserId = 'user1';
      const searchResults = [{ id: 'user2', username: 'john_doe' }];

      mockUserServiceClient.searchUsers.mockResolvedValue(searchResults);

      const result = await service.searchUsers(query, currentUserId);

      expect(result).toEqual(searchResults);
      expect(mockUserServiceClient.searchUsers).toHaveBeenCalledWith(query, currentUserId);
    });

    it('should return empty array on search error', async () => {
      const query = 'john';
      const currentUserId = 'user1';

      mockUserServiceClient.searchUsers.mockRejectedValue(new Error('Service unavailable'));

      const result = await service.searchUsers(query, currentUserId);

      expect(result).toEqual([]);
    });
  });

  describe('getFriendsForAchievements', () => {
    it('should return friend IDs for achievements', async () => {
      const userId = 'user1';
      const friendships = [
        { userId, friendId: 'user2', status: FriendshipStatus.ACCEPTED },
        { userId: 'user3', friendId: userId, status: FriendshipStatus.ACCEPTED },
      ];

      mockFriendshipRepository.find.mockResolvedValue(friendships);

      const result = await service.getFriendsForAchievements(userId);

      expect(result).toEqual(['user2', 'user3']);
    });
  });
});
