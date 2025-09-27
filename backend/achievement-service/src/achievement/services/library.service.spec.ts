import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LibraryService, UserLibraryStats, UserLibraryGame } from './library.service';

// Mock fetch globally
global.fetch = jest.fn();

describe('LibraryService', () => {
  let service: LibraryService;
  let configService: ConfigService;

  const testUserId = '123e4567-e89b-12d3-a456-426614174000';
  const testGameId = '123e4567-e89b-12d3-a456-426614174001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LibraryService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://library-service:3000'),
          },
        },
      ],
    }).compile();

    service = module.get<LibraryService>(LibraryService);
    configService = module.get<ConfigService>(ConfigService);

    // Reset fetch mock
    (fetch as jest.Mock).mockReset();
  });

  describe('getUserGameCount', () => {
    it('should return game count successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ count: 5 }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.getUserGameCount(testUserId);

      expect(result).toBe(5);
      expect(fetch).toHaveBeenCalledWith(
        `http://library-service:3000/api/library/${testUserId}/count`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );
    });

    it('should return 0 when service returns error', async () => {
      const mockResponse = { ok: false, status: 500 };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.getUserGameCount(testUserId);

      expect(result).toBe(0);
    });

    it('should return 0 on network error', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.getUserGameCount(testUserId);

      expect(result).toBe(0);
    });

    it('should handle missing count in response', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.getUserGameCount(testUserId);

      expect(result).toBe(0);
    });
  });

  describe('getUserLibraryStats', () => {
    it('should return library stats successfully', async () => {
      const mockStats: UserLibraryStats = {
        totalGames: 10,
        totalSpent: 19990,
        firstPurchaseDate: '2024-01-01T00:00:00.000Z',
        lastPurchaseDate: '2024-01-10T00:00:00.000Z',
        favoriteGenre: 'Action',
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ stats: mockStats }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.getUserLibraryStats(testUserId);

      expect(result).toEqual(mockStats);
      expect(fetch).toHaveBeenCalledWith(
        `http://library-service:3000/api/library/${testUserId}/stats`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );
    });

    it('should return null when service returns error', async () => {
      const mockResponse = { ok: false, status: 500 };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.getUserLibraryStats(testUserId);

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.getUserLibraryStats(testUserId);

      expect(result).toBeNull();
    });
  });

  describe('hasGameInLibrary', () => {
    it('should return true when game exists', async () => {
      const mockResponse = { ok: true };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.hasGameInLibrary(testUserId, testGameId);

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        `http://library-service:3000/api/library/${testUserId}/games/${testGameId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );
    });

    it('should return false when game not found (404)', async () => {
      const mockResponse = { ok: false, status: 404 };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.hasGameInLibrary(testUserId, testGameId);

      expect(result).toBe(false);
    });

    it('should return false on other errors', async () => {
      const mockResponse = { ok: false, status: 500 };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.hasGameInLibrary(testUserId, testGameId);

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.hasGameInLibrary(testUserId, testGameId);

      expect(result).toBe(false);
    });
  });

  describe('getUserGames', () => {
    it('should return user games successfully', async () => {
      const mockGames: UserLibraryGame[] = [
        {
          gameId: 'game-1',
          gameName: 'Test Game 1',
          addedAt: '2024-01-01T00:00:00.000Z',
          purchasePrice: 1999,
          platform: 'PC',
        },
        {
          gameId: 'game-2',
          gameName: 'Test Game 2',
          addedAt: '2024-01-02T00:00:00.000Z',
          purchasePrice: 2999,
          platform: 'PC',
        },
      ];

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ games: mockGames }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.getUserGames(testUserId, 10, 0);

      expect(result).toEqual(mockGames);
      expect(fetch).toHaveBeenCalledWith(
        `http://library-service:3000/api/library/${testUserId}/games?limit=10&offset=0`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );
    });

    it('should use default pagination parameters', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ games: [] }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await service.getUserGames(testUserId);

      expect(fetch).toHaveBeenCalledWith(
        `http://library-service:3000/api/library/${testUserId}/games?limit=100&offset=0`,
        expect.any(Object),
      );
    });

    it('should return empty array on error', async () => {
      const mockResponse = { ok: false, status: 500 };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.getUserGames(testUserId);

      expect(result).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.getUserGames(testUserId);

      expect(result).toEqual([]);
    });
  });

  describe('checkLibraryServiceHealth', () => {
    it('should return true when service is healthy', async () => {
      const mockResponse = { ok: true };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.checkLibraryServiceHealth();

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('http://library-service:3000/health', {
        method: 'GET',
        headers: {
          'X-Service-Name': 'achievement-service',
        },
      });
    });

    it('should return false when service is unhealthy', async () => {
      const mockResponse = { ok: false };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.checkLibraryServiceHealth();

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.checkLibraryServiceHealth();

      expect(result).toBe(false);
    });
  });

  describe('getFirstPurchaseInfo', () => {
    it('should return first purchase info successfully', async () => {
      const mockStats: UserLibraryStats = {
        totalGames: 5,
        totalSpent: 9995,
        firstPurchaseDate: '2024-01-01T00:00:00.000Z',
      };

      const mockGames: UserLibraryGame[] = [
        {
          gameId: 'first-game',
          gameName: 'First Game',
          addedAt: '2024-01-01T00:00:00.000Z',
          purchasePrice: 1999,
        },
      ];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ stats: mockStats }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ games: mockGames }),
        });

      const result = await service.getFirstPurchaseInfo(testUserId);

      expect(result).toEqual({
        gameId: 'first-game',
        purchaseDate: '2024-01-01T00:00:00.000Z',
      });
    });

    it('should return null when no first purchase date', async () => {
      const mockStats: UserLibraryStats = {
        totalGames: 0,
        totalSpent: 0,
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ stats: mockStats }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.getFirstPurchaseInfo(testUserId);

      expect(result).toBeNull();
    });

    it('should return null when no games in library', async () => {
      const mockStats: UserLibraryStats = {
        totalGames: 1,
        totalSpent: 1999,
        firstPurchaseDate: '2024-01-01T00:00:00.000Z',
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ stats: mockStats }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ games: [] }),
        });

      const result = await service.getFirstPurchaseInfo(testUserId);

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.getFirstPurchaseInfo(testUserId);

      expect(result).toBeNull();
    });
  });

  describe('configuration', () => {
    it('should use custom library service URL from config', async () => {
      const customUrl = 'http://custom-library:4000';
      (configService.get as jest.Mock).mockReturnValue(customUrl);

      // Create new service instance with updated config
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LibraryService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(customUrl),
            },
          },
        ],
      }).compile();

      const customService = module.get<LibraryService>(LibraryService);

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ count: 5 }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await customService.getUserGameCount(testUserId);

      expect(fetch).toHaveBeenCalledWith(
        `${customUrl}/api/library/${testUserId}/count`,
        expect.any(Object),
      );
    });
  });
});
