import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FriendsService } from './friends.service';
import { Friendship } from './entities/friendship.entity';
import { Repository } from 'typeorm';
import { FriendshipStatus } from './entities/friendship-status.enum';
import { AlreadyFriendsException } from '../common/exceptions/already-friends.exception';

// Mock repository
const mockFriendshipRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  remove: jest.fn(),
  findOneBy: jest.fn(),
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
      mockFriendshipRepository.findOne.mockResolvedValue({ status: FriendshipStatus.ACCEPTED });
      await expect(service.sendFriendRequest('user1', 'user2')).rejects.toThrow(AlreadyFriendsException);
    });

    it('should throw an error if request is already pending', async () => {
        mockFriendshipRepository.findOne.mockResolvedValue({ status: FriendshipStatus.PENDING });
        await expect(service.sendFriendRequest('user1', 'user2')).rejects.toThrow('A friend request is already pending.');
    });

    it('should send a friend request successfully', async () => {
      const fromUserId = 'user1';
      const toUserId = 'user2';
      const newRequest = { fromUserId, toUserId, status: FriendshipStatus.PENDING };

      mockFriendshipRepository.findOne.mockResolvedValue(null);
      mockFriendshipRepository.create.mockReturnValue(newRequest);
      mockFriendshipRepository.save.mockResolvedValue(newRequest);

      const result = await service.sendFriendRequest(fromUserId, toUserId);
      expect(result).toEqual(newRequest);
      expect(mockFriendshipRepository.create).toHaveBeenCalledWith({
        userId: fromUserId,
        friendId: toUserId,
        status: FriendshipStatus.PENDING,
        requestedBy: fromUserId,
      });
      expect(mockFriendshipRepository.save).toHaveBeenCalledWith(newRequest);
    });
  });

  describe('acceptFriendRequest', () => {
      it('should accept a friend request successfully', async () => {
        const requestId = 'req1';
        const userId = 'user2';
        const request = { id: requestId, userId: 'user1', friendId: userId, status: FriendshipStatus.PENDING, requestedBy: 'user1' };

        mockFriendshipRepository.findOneBy.mockResolvedValue(request);
        mockFriendshipRepository.save.mockImplementation(async (entities) => entities);

        const result = await service.acceptFriendRequest(requestId, userId);

        expect(result.status).toEqual(FriendshipStatus.ACCEPTED);
        expect(mockFriendshipRepository.save).toHaveBeenCalled();
      });
  });

  describe('declineFriendRequest', () => {
      it('should decline a friend request successfully', async () => {
        const requestId = 'req1';
        const userId = 'user2';
        const request = { id: requestId, userId: 'user1', friendId: userId, status: FriendshipStatus.PENDING };

        mockFriendshipRepository.findOneBy.mockResolvedValue(request);

        await service.declineFriendRequest(requestId, userId);

        expect(mockFriendshipRepository.remove).toHaveBeenCalledWith(request);
      });
  });

  describe('removeFriend', () => {
      it('should remove a friend successfully', async () => {
          const userId = 'user1';
          const friendId = 'user2';
          const friendship = { userId, friendId, status: FriendshipStatus.ACCEPTED };
          const reverseFriendship = { userId: friendId, friendId: userId, status: FriendshipStatus.ACCEPTED };

          // Mock finding both directions of the friendship
          mockFriendshipRepository.findOne
              .mockResolvedValueOnce(friendship) // First call for the main friendship
              .mockResolvedValueOnce(reverseFriendship); // Second call for the reverse

          await service.removeFriend(userId, friendId);

          expect(mockFriendshipRepository.remove).toHaveBeenCalledWith([friendship, reverseFriendship]);
      });
  });

  describe('getFriends', () => {
    it('should return a paginated list of friends', async () => {
      const userId = 'user1';
      const friends = [{ userId, friendId: 'user2', status: FriendshipStatus.ACCEPTED }];
      const total = 1;

      mockFriendshipRepository.findAndCount.mockResolvedValue([friends, total]);

      const result = await service.getFriends(userId, { page: 1, limit: 10 });

      expect(result.friends).toEqual(friends);
      expect(result.pagination.total).toEqual(total);
    });
  });

  describe('checkFriendship', () => {
      it('should return true if users are friends', async () => {
          mockFriendshipRepository.findOne.mockResolvedValue({ status: FriendshipStatus.ACCEPTED });
          const result = await service.checkFriendship('user1', 'user2');
          expect(result).toBe(true);
      });

      it('should return false if users are not friends', async () => {
          mockFriendshipRepository.findOne.mockResolvedValue(null);
          const result = await service.checkFriendship('user1', 'user2');
          expect(result).toBe(false);
      });
  });
});
