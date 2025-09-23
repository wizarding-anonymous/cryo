import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MessagingService } from './messaging.service';
import { Message } from './entities/message.entity';
import { FriendsService } from '../friends/friends.service';
import { Repository } from 'typeorm';
import { NotFriendsException } from '../common/exceptions/not-friends.exception';
import { MessageNotFoundException } from '../common/exceptions/message-not-found.exception';
import { RateLimitExceededException } from '../common/exceptions/rate-limit-exceeded.exception';
import { NotificationServiceClient } from '../clients/notification.service.client';
import { UserServiceClient } from '../clients/user.service.client';
import { CacheService } from '../cache/cache.service';

const mockMessageRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOneBy: jest.fn(),
  findAndCount: jest.fn(),
  count: jest.fn(),
  query: jest.fn(),
};

const mockFriendsService = {
  checkFriendship: jest.fn(),
};

const mockNotificationServiceClient = {
  sendNotification: jest.fn(),
};

const mockUserServiceClient = {
  getUsersByIds: jest.fn(),
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
};

describe('MessagingService', () => {
  let service: MessagingService;
  let repository: Repository<Message>;
  let friendsService: FriendsService;
  let cacheService: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        {
          provide: getRepositoryToken(Message),
          useValue: mockMessageRepository,
        },
        {
          provide: FriendsService,
          useValue: mockFriendsService,
        },
        {
          provide: NotificationServiceClient,
          useValue: mockNotificationServiceClient,
        },
        {
          provide: UserServiceClient,
          useValue: mockUserServiceClient,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<MessagingService>(MessagingService);
    repository = module.get<Repository<Message>>(getRepositoryToken(Message));
    friendsService = module.get<FriendsService>(FriendsService);
    cacheService = module.get<CacheService>(CacheService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMessage', () => {
    const sendMessageDto = { toUserId: 'user2', content: 'Hello' };
    const fromUserId = 'user1';

    it('should throw RateLimitExceededException if rate limit is exceeded', async () => {
      mockCacheService.get.mockResolvedValue(20); // At limit
      await expect(service.sendMessage(fromUserId, sendMessageDto)).rejects.toThrow(
        RateLimitExceededException,
      );
    });

    it('should throw NotFriendsException if users are not friends', async () => {
      mockCacheService.get.mockResolvedValue(null); // No rate limit hit
      mockFriendsService.checkFriendship.mockResolvedValue(false);
      await expect(service.sendMessage(fromUserId, sendMessageDto)).rejects.toThrow(
        NotFriendsException,
      );
    });

    it('should send a message successfully if users are friends', async () => {
      const message = { id: 'msg1', fromUserId, ...sendMessageDto, createdAt: new Date() };
      mockCacheService.get.mockResolvedValue(null); // No rate limit hit
      mockFriendsService.checkFriendship.mockResolvedValue(true);
      mockMessageRepository.create.mockReturnValue(message);
      mockMessageRepository.save.mockResolvedValue(message);
      mockNotificationServiceClient.sendNotification.mockResolvedValue(undefined);

      const result = await service.sendMessage(fromUserId, sendMessageDto);
      expect(result.id).toEqual(message.id);
      expect(mockMessageRepository.create).toHaveBeenCalledWith({
        fromUserId,
        toUserId: sendMessageDto.toUserId,
        content: sendMessageDto.content,
      });
      expect(mockMessageRepository.save).toHaveBeenCalledWith(message);
      expect(mockNotificationServiceClient.sendNotification).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith(`rate-limit:messages:${fromUserId}`, 1, 60);
    });

    it('should handle notification service errors gracefully', async () => {
      const message = { id: 'msg1', fromUserId, ...sendMessageDto, createdAt: new Date() };
      mockCacheService.get.mockResolvedValue(null);
      mockFriendsService.checkFriendship.mockResolvedValue(true);
      mockMessageRepository.create.mockReturnValue(message);
      mockMessageRepository.save.mockResolvedValue(message);
      mockNotificationServiceClient.sendNotification.mockRejectedValue(
        new Error('Service unavailable'),
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.sendMessage(fromUserId, sendMessageDto);
      expect(result.id).toEqual(message.id);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to send notification:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('getConversation', () => {
    const userId = 'user1';
    const friendId = 'user2';

    it('should throw NotFriendsException if users are not friends', async () => {
      mockFriendsService.checkFriendship.mockResolvedValue(false);
      await expect(
        service.getConversation(userId, friendId, { page: 1, limit: 10 }),
      ).rejects.toThrow(NotFriendsException);
    });

    it('should return a paginated list of messages', async () => {
      const messages = [{ id: 'msg1', content: 'Hi', createdAt: new Date() }];
      const total = 1;

      mockFriendsService.checkFriendship.mockResolvedValue(true);
      mockMessageRepository.findAndCount.mockResolvedValue([messages, total]);

      const result = await service.getConversation(userId, friendId, {
        page: 1,
        limit: 10,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.pagination.total).toEqual(total);
      expect(mockFriendsService.checkFriendship).toHaveBeenCalledWith(userId, friendId);
    });
  });

  describe('markAsRead', () => {
    const messageId = 'msg1';
    const userId = 'user2';

    it('should throw MessageNotFoundException if message does not exist', async () => {
      mockMessageRepository.findOneBy.mockResolvedValue(null);
      await expect(service.markAsRead(messageId, userId)).rejects.toThrow(MessageNotFoundException);
    });

    it('should throw MessageNotFoundException if message does not belong to the user', async () => {
      const message = { id: messageId, toUserId: 'anotherUser' };
      mockMessageRepository.findOneBy.mockResolvedValue(message);
      await expect(service.markAsRead(messageId, userId)).rejects.toThrow(MessageNotFoundException);
    });

    it('should mark a message as read successfully', async () => {
      const message = {
        id: messageId,
        toUserId: userId,
        isRead: false,
        readAt: null,
      };
      mockMessageRepository.findOneBy.mockResolvedValue(message);

      await service.markAsRead(messageId, userId);

      expect(message.isRead).toBe(true);
      expect(message.readAt).toBeInstanceOf(Date);
      expect(mockMessageRepository.save).toHaveBeenCalledWith(message);
    });

    it('should not save if message is already read', async () => {
      const message = { id: messageId, toUserId: userId, isRead: true };
      mockMessageRepository.findOneBy.mockResolvedValue(message);

      await service.markAsRead(messageId, userId);

      expect(mockMessageRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getConversations', () => {
    it('should return empty array if no conversations exist', async () => {
      mockMessageRepository.query.mockResolvedValue([]);

      const result = await service.getConversations('user1');

      expect(result).toEqual([]);
    });

    it('should return conversations with unread counts', async () => {
      const userId = 'user1';
      const recentMessages = [
        {
          id: 'msg1',
          fromUserId: 'user2',
          toUserId: userId,
          content: 'Hello',
          isRead: false,
          readAt: null,
          createdAt: new Date(),
          partner_id: 'user2',
        },
      ];
      const partnersInfo = [
        {
          id: 'user2',
          username: 'friend1',
          avatar: null,
          onlineStatus: 'online',
        },
      ];

      mockMessageRepository.query.mockResolvedValue(recentMessages);
      mockUserServiceClient.getUsersByIds.mockResolvedValue(partnersInfo);
      mockMessageRepository.count.mockResolvedValue(1); // 1 unread message

      const result = await service.getConversations(userId);

      expect(result).toHaveLength(1);
      expect(result[0]?.friendId).toBe('user2');
      expect(result[0]?.unreadCount).toBe(1);
      expect(result[0]?.friendInfo.username).toBe('friend1');
    });
  });

  describe('getUnreadCount', () => {
    it('should return the count of unread messages', async () => {
      const userId = 'user1';
      const count = 5;
      mockMessageRepository.count.mockResolvedValue(count);

      const result = await service.getUnreadCount(userId);

      expect(result).toEqual(count);
      expect(mockMessageRepository.count).toHaveBeenCalledWith({
        where: { toUserId: userId, isRead: false },
      });
    });
  });
});
