import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from './messages.controller';
import { MessagingService } from './messaging.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FriendshipGuard } from '../auth/guards/friendship.guard';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';

const mockMessagingService = {
  sendMessage: jest.fn(),
  getConversations: jest.fn(),
  getConversation: jest.fn(),
  markAsRead: jest.fn(),
};

describe('MessagesController', () => {
  let controller: MessagesController;
  let service: MessagingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: MessagingService,
          useValue: mockMessagingService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(FriendshipGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MessagesController>(MessagesController);
    service = module.get<MessagingService>(MessagingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  const mockAuthRequest = { user: { userId: 'user1' } } as any;

  describe('sendMessage', () => {
    it('should call service with correct params', async () => {
      const dto = { toUserId: 'user2', content: 'Hello' };
      await controller.sendMessage(mockAuthRequest, dto);
      expect(service.sendMessage).toHaveBeenCalledWith('user1', dto);
    });
  });

  describe('getConversations', () => {
    it('should call service with correct params', async () => {
      await controller.getConversations(mockAuthRequest);
      expect(service.getConversations).toHaveBeenCalledWith('user1');
    });
  });

  describe('getConversation', () => {
    it('should call service with correct params', async () => {
      const friendId = 'user2';
      const query = { page: 1, limit: 50 };
      await controller.getConversation(mockAuthRequest, friendId, query);
      expect(service.getConversation).toHaveBeenCalledWith(
        'user1',
        friendId,
        query,
      );
    });
  });

  describe('markAsRead', () => {
    it('should call service with correct params', async () => {
      const messageId = 'msg1';
      await controller.markAsRead(mockAuthRequest, messageId);
      expect(service.markAsRead).toHaveBeenCalledWith(messageId, 'user1');
    });
  });
});
