import { Test, TestingModule } from '@nestjs/testing';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const mockFriendsService = {
  sendFriendRequest: jest.fn(),
  acceptFriendRequest: jest.fn(),
  declineFriendRequest: jest.fn(),
  removeFriend: jest.fn(),
  getFriends: jest.fn(),
  getFriendRequests: jest.fn(),
  searchUsers: jest.fn(),
};

// Mock AuthGuard to allow requests
const mockJwtAuthGuard = {
  canActivate: jest.fn(() => true),
};

describe('FriendsController', () => {
  let controller: FriendsController;
  let service: FriendsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FriendsController],
      providers: [
        {
          provide: FriendsService,
          useValue: mockFriendsService,
        },
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue(mockJwtAuthGuard)
    .compile();

    controller = module.get<FriendsController>(FriendsController);
    service = module.get<FriendsService>(FriendsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  const mockAuthRequest = { user: { userId: 'user1' } } as any;

  describe('sendFriendRequest', () => {
    it('should call service with correct params', async () => {
      const dto = { toUserId: 'user2' };
      mockFriendsService.sendFriendRequest.mockResolvedValue('ok');
      const result = await controller.sendFriendRequest(mockAuthRequest, dto);
      expect(service.sendFriendRequest).toHaveBeenCalledWith('user1', 'user2');
      expect(result).toEqual('ok');
    });
  });

  describe('acceptFriendRequest', () => {
    it('should call service with correct params', async () => {
      const requestId = 'req1';
      await controller.acceptFriendRequest(mockAuthRequest, requestId);
      expect(service.acceptFriendRequest).toHaveBeenCalledWith(requestId, 'user1');
    });
  });

  describe('declineFriendRequest', () => {
    it('should call service with correct params', async () => {
        const requestId = 'req1';
        await controller.declineFriendRequest(mockAuthRequest, requestId);
        expect(service.declineFriendRequest).toHaveBeenCalledWith(requestId, 'user1');
    });
  });

  describe('removeFriend', () => {
    it('should call service with correct params', async () => {
        const friendId = 'user2';
        await controller.removeFriend(mockAuthRequest, friendId);
        expect(service.removeFriend).toHaveBeenCalledWith('user1', friendId);
    });
  });

  describe('getFriends', () => {
    it('should call service with correct params', async () => {
        const query = { page: 1, limit: 10 };
        await controller.getFriends(mockAuthRequest, query);
        expect(service.getFriends).toHaveBeenCalledWith('user1', query);
    });
  });

  describe('getFriendRequests', () => {
    it('should call service with correct params', async () => {
        await controller.getFriendRequests(mockAuthRequest);
        expect(service.getFriendRequests).toHaveBeenCalledWith('user1');
    });
  });

  describe('searchUsers', () => {
    it('should call service with correct params', async () => {
        const query = 'test';
        await controller.searchUsers(mockAuthRequest, query);
        expect(service.searchUsers).toHaveBeenCalledWith(query, 'user1');
    });
  });
});
