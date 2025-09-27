import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { GameCatalogService } from './game-catalog.service';
import { GameRating } from '../entities/game-rating.entity';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('GameCatalogService', () => {
  let service: GameCatalogService;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockHttpService = {
    put: jest.fn(),
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameCatalogService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GameCatalogService>(GameCatalogService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);

    // Setup default config values with reduced timeouts for tests
    mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        GAME_CATALOG_SERVICE_URL: 'http://game-catalog-service:3000',
        GAME_CATALOG_REQUEST_TIMEOUT: 100, // Very short for tests
        GAME_CATALOG_MAX_RETRIES: 0, // No retries for tests
      };
      return config[key] || defaultValue;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateGameRating', () => {
    it('should successfully update game rating in catalog', async () => {
      const gameRating: GameRating = {
        gameId: 'game-123',
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date('2023-01-01T00:00:00Z'),
      };

      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.put.mockReturnValue(of(mockResponse));

      const result = await service.updateGameRating(gameRating);

      expect(result).toBe(true);
      expect(mockHttpService.put).toHaveBeenCalledWith(
        'http://game-catalog-service:3000/games/game-123/rating',
        {
          gameId: 'game-123',
          averageRating: 4.25,
          totalReviews: 42,
          timestamp: '2023-01-01T00:00:00.000Z',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          },
        }
      );
    });

    it('should handle game catalog service failure gracefully', async () => {
      const gameRating: GameRating = {
        gameId: 'game-123',
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date(),
      };

      mockHttpService.put.mockReturnValue(throwError(() => new Error('Service unavailable')));

      const result = await service.updateGameRating(gameRating);

      expect(result).toBe(false);
    });

    it('should handle game catalog service returning failure response', async () => {
      const gameRating: GameRating = {
        gameId: 'game-123',
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date(),
      };

      const mockResponse: AxiosResponse = {
        data: { success: false, message: 'Update failed' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.put.mockReturnValue(of(mockResponse));

      const result = await service.updateGameRating(gameRating);

      expect(result).toBe(false);
    });
  });

  describe('getGameInfo', () => {
    it('should return game info when game exists', async () => {
      const gameId = 'game-123';

      const mockResponse: AxiosResponse = {
        data: { id: 'game-123', name: 'Test Game', description: 'A test game' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getGameInfo(gameId);

      expect(result).toEqual({
        name: 'Test Game',
        exists: true,
      });
      expect(mockHttpService.get).toHaveBeenCalledWith(
        'http://game-catalog-service:3000/games/game-123',
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          },
        }
      );
    });

    it('should return exists false when game not found', async () => {
      const gameId = 'game-123';

      const mockError = {
        response: { status: 404 },
        message: 'Not found',
      };

      mockHttpService.get.mockReturnValue(throwError(() => mockError));

      const result = await service.getGameInfo(gameId);

      expect(result).toEqual({
        exists: false,
      });
    });

    it('should return exists false when service is unavailable', async () => {
      const gameId = 'game-123';

      mockHttpService.get.mockReturnValue(throwError(() => new Error('Service unavailable')));

      const result = await service.getGameInfo(gameId);

      expect(result).toEqual({
        exists: false,
      });
    });
  });

  describe('getServiceHealth', () => {
    it('should return healthy status when service is available', async () => {
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getServiceHealth();

      expect(result).toEqual({
        status: 'healthy',
        gameCatalogService: true,
      });
    });

    it('should return unhealthy status when service is unavailable', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Service unavailable')));

      const result = await service.getServiceHealth();

      expect(result).toEqual({
        status: 'unhealthy',
        gameCatalogService: false,
      });
    });
  });
});