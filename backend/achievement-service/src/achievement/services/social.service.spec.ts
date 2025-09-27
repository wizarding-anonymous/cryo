import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SocialService } from './social.service';

// Mock fetch globally
global.fetch = jest.fn();

describe('SocialService', () => {
  let service: SocialService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://social-service:3000'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SocialService>(SocialService);
    configService = module.get<ConfigService>(ConfigService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('getFriendship', () => {
    it('should get friendship successfully', async () => {
      const mockFriendship = {
        friendshipId: 'friendship-1',
        userId: 'user-1',
        friendId: 'user-2',
        status: 'accepted',
        createdAt: '2024-01-01T00:00:00.000Z',
        acceptedAt: '2024-01-01T00:00:00.000Z',
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ friendship: mockFriendship }),
      });

      const result = await service.getFriendship('friendship-1');

      expect(result).toEqual(mockFriendship);
      expect(fetch).toHaveBeenCalledWith(
        'http://social-service:3000/api/friendships/friendship-1',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );
    });

    it('should return null when friendship not found', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await service.getFriendship('friendship-nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when service error occurs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.getFriendship('friendship-1');

      expect(result).toBeNull();
    });

    it('should return null when network error occurs', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.getFriendship('friendship-1');

      expect(result).toBeNull();
    });
  });

  describe('getUserFriends', () => {
    it('should get user friends successfully', async () => {
      const mockFriends = [
        {
          friendshipId: 'friendship-1',
          userId: 'user-1',
          friendId: 'user-2',
          status: 'accepted',
          createdAt: '2024-01-01T00:00:00.000Z',
          acceptedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ friends: mockFriends }),
      });

      const result = await service.getUserFriends('user-1');

      expect(result).toEqual(mockFriends);
      expect(fetch).toHaveBeenCalledWith(
        'http://social-service:3000/api/users/user-1/friends?limit=50&offset=0',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );
    });

    it('should return empty array when service error occurs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.getUserFriends('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getUserFriendCount', () => {
    it('should get user friend count successfully', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ count: 5 }),
      });

      const result = await service.getUserFriendCount('user-1');

      expect(result).toBe(5);
      expect(fetch).toHaveBeenCalledWith(
        'http://social-service:3000/api/users/user-1/friends/count',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );
    });

    it('should return 0 when service error occurs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.getUserFriendCount('user-1');

      expect(result).toBe(0);
    });

    it('should return 0 when network error occurs', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.getUserFriendCount('user-1');

      expect(result).toBe(0);
    });
  });

  describe('getUserSocialStats', () => {
    it('should get user social stats successfully', async () => {
      const mockStats = {
        totalFriends: 10,
        pendingRequests: 2,
        sentRequests: 1,
        firstFriendDate: '2024-01-01T00:00:00.000Z',
        lastFriendAddedDate: '2024-01-10T00:00:00.000Z',
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ stats: mockStats }),
      });

      const result = await service.getUserSocialStats('user-1');

      expect(result).toEqual(mockStats);
    });

    it('should return null when service error occurs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.getUserSocialStats('user-1');

      expect(result).toBeNull();
    });
  });

  describe('areFriends', () => {
    it('should return true when users are friends', async () => {
      const mockFriendship = {
        friendshipId: 'friendship-1',
        userId: 'user-1',
        friendId: 'user-2',
        status: 'accepted',
        createdAt: '2024-01-01T00:00:00.000Z',
        acceptedAt: '2024-01-01T00:00:00.000Z',
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ friendship: mockFriendship }),
      });

      const result = await service.areFriends('user-1', 'user-2');

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'http://social-service:3000/api/users/user-1/friends/user-2',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );
    });

    it('should return false when users are not friends', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await service.areFriends('user-1', 'user-2');

      expect(result).toBe(false);
    });

    it('should return false when friendship is pending', async () => {
      const mockFriendship = {
        friendshipId: 'friendship-1',
        userId: 'user-1',
        friendId: 'user-2',
        status: 'pending',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ friendship: mockFriendship }),
      });

      const result = await service.areFriends('user-1', 'user-2');

      expect(result).toBe(false);
    });

    it('should return false when service error occurs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.areFriends('user-1', 'user-2');

      expect(result).toBe(false);
    });
  });

  describe('getPendingFriendRequests', () => {
    it('should get pending friend requests successfully', async () => {
      const mockRequests = [
        {
          friendshipId: 'friendship-1',
          userId: 'user-2',
          friendId: 'user-1',
          status: 'pending',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ requests: mockRequests }),
      });

      const result = await service.getPendingFriendRequests('user-1');

      expect(result).toEqual(mockRequests);
      expect(fetch).toHaveBeenCalledWith(
        'http://social-service:3000/api/users/user-1/friend-requests/incoming',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );
    });

    it('should return empty array when service error occurs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.getPendingFriendRequests('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getSentFriendRequests', () => {
    it('should get sent friend requests successfully', async () => {
      const mockRequests = [
        {
          friendshipId: 'friendship-1',
          userId: 'user-1',
          friendId: 'user-2',
          status: 'pending',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ requests: mockRequests }),
      });

      const result = await service.getSentFriendRequests('user-1');

      expect(result).toEqual(mockRequests);
      expect(fetch).toHaveBeenCalledWith(
        'http://social-service:3000/api/users/user-1/friend-requests/outgoing',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );
    });

    it('should return empty array when service error occurs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.getSentFriendRequests('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('checkSocialServiceHealth', () => {
    it('should return true when service is healthy', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await service.checkSocialServiceHealth();

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('http://social-service:3000/health', {
        method: 'GET',
        headers: {
          'X-Service-Name': 'achievement-service',
        },
      });
    });

    it('should return false when service is unhealthy', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.checkSocialServiceHealth();

      expect(result).toBe(false);
    });

    it('should return false when network error occurs', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.checkSocialServiceHealth();

      expect(result).toBe(false);
    });
  });

  describe('getFirstFriendInfo', () => {
    it('should get first friend info successfully', async () => {
      const mockStats = {
        totalFriends: 5,
        pendingRequests: 0,
        sentRequests: 0,
        firstFriendDate: '2024-01-01T00:00:00.000Z',
        lastFriendAddedDate: '2024-01-05T00:00:00.000Z',
      };

      const mockFriends = [
        {
          friendshipId: 'friendship-1',
          userId: 'user-1',
          friendId: 'user-2',
          status: 'accepted',
          createdAt: '2024-01-01T00:00:00.000Z',
          acceptedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ stats: mockStats }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ friends: mockFriends }),
        });

      const result = await service.getFirstFriendInfo('user-1');

      expect(result).toEqual({
        friendId: 'user-2',
        addedAt: '2024-01-01T00:00:00.000Z',
      });
    });

    it('should return null when no friends exist', async () => {
      const mockStats = {
        totalFriends: 0,
        pendingRequests: 0,
        sentRequests: 0,
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ stats: mockStats }),
      });

      const result = await service.getFirstFriendInfo('user-1');

      expect(result).toBeNull();
    });

    it('should return null when service error occurs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.getFirstFriendInfo('user-1');

      expect(result).toBeNull();
    });
  });

  describe('validateFriendAddedEvent', () => {
    it('should return true when friendship is valid', async () => {
      const mockFriendship = {
        friendshipId: 'friendship-1',
        userId: 'user-1',
        friendId: 'user-2',
        status: 'accepted',
        createdAt: '2024-01-01T00:00:00.000Z',
        acceptedAt: '2024-01-01T00:00:00.000Z',
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ friendship: mockFriendship }),
      });

      const result = await service.validateFriendAddedEvent('user-1', 'user-2');

      expect(result).toBe(true);
    });

    it('should return false when friendship is not valid', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await service.validateFriendAddedEvent('user-1', 'user-2');

      expect(result).toBe(false);
    });

    it('should return false when service error occurs', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.validateFriendAddedEvent('user-1', 'user-2');

      expect(result).toBe(false);
    });
  });
});