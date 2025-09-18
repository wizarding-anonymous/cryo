import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MessagingService } from './messaging.service';
import { Message } from './entities/message.entity';
import { FriendsService } from '../friends/friends.service';
import { Repository } from 'typeorm';
import { NotFriendsException } from '../common/exceptions/not-friends.exception';
import { MessageNotFoundException } from '../common/exceptions/message-not-found.exception';

const mockMessageRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOneBy: jest.fn(),
  findAndCount: jest.fn(),
  count: jest.fn(),
};

const mockFriendsService = {
  checkFriendship: jest.fn(),
};

describe('MessagingService', () => {
  let service: MessagingService;
  let repository: Repository<Message>;
  let friendsService: FriendsService;

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
      ],
    }).compile();

    service = module.get<MessagingService>(MessagingService);
    repository = module.get<Repository<Message>>(getRepositoryToken(Message));
    friendsService = module.get<FriendsService>(FriendsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMessage', () => {
    const sendMessageDto = { toUserId: 'user2', content: 'Hello' };
    const fromUserId = 'user1';

    it('should throw NotFriendsException if users are not friends', async () => {
      mockFriendsService.checkFriendship.mockResolvedValue(false);
      await expect(service.sendMessage(fromUserId, sendMessageDto)).rejects.toThrow(NotFriendsException);
    });

    it('should send a message successfully if users are friends', async () => {
      const message = { fromUserId, ...sendMessageDto };
      mockFriendsService.checkFriendship.mockResolvedValue(true);
      mockMessageRepository.create.mockReturnValue(message);
      mockMessageRepository.save.mockResolvedValue(message);

      const result = await service.sendMessage(fromUserId, sendMessageDto);
      expect(result).toEqual(message);
      expect(mockMessageRepository.create).toHaveBeenCalledWith({
        fromUserId,
        toUserId: sendMessageDto.toUserId,
        content: sendMessageDto.content,
      });
      expect(mockMessageRepository.save).toHaveBeenCalledWith(message);
    });
  });

  describe('getConversation', () => {
    it('should return a paginated list of messages', async () => {
      const userId = 'user1';
      const friendId = 'user2';
      const messages = [{ id: 'msg1', content: 'Hi' }];
      const total = 1;

      mockMessageRepository.findAndCount.mockResolvedValue([messages, total]);

      const result = await service.getConversation(userId, friendId, { page: 1, limit: 10 });

      expect(result.messages).toEqual(messages.reverse());
      expect(result.pagination.total).toEqual(total);
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
      const message = { id: messageId, toUserId: userId, isRead: false, readAt: null };
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
