/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GetGamesDto } from '../dto/get-games.dto';
import { GameResponseDto } from '../dto/game-response.dto';
import { GameListResponseDto } from '../dto/game-list-response.dto';
import { PurchaseInfoDto } from '../dto/purchase-info.dto';
import { Game } from '../entities/game.entity';
import { PerformanceInterceptor } from '../common/interceptors/performance.interceptor';
import { PerformanceMonitoringService } from '../common/services/performance-monitoring.service';
import { HttpCacheInterceptor } from '../common/interceptors/http-cache.interceptor';
import { CacheService } from '../common/services/cache.service';
import { RedisConfigService } from '../database/redis-config.service';

const mockGameService = {
  getAllGames: jest.fn(),
  getGameById: jest.fn(),
  getGamePurchaseInfo: jest.fn(),
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  delByPattern: jest.fn(),
  invalidateGameCache: jest.fn(),
  getCacheStats: jest.fn(),
};

const mockPerformanceMonitoringService = {
  recordEndpointMetrics: jest.fn(),
};

const mockRedisConfigService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  isAvailable: jest.fn().mockReturnValue(true),
  getClient: jest.fn(),
  clearPattern: jest.fn(),
  createCacheKey: jest.fn(),
  getStats: jest.fn(),
};

describe('GameController', () => {
  let controller: GameController;
  let service: GameService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameController],
      providers: [
        {
          provide: GameService,
          useValue: mockGameService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: PerformanceInterceptor,
          useValue: {},
        },
        {
          provide: PerformanceMonitoringService,
          useValue: mockPerformanceMonitoringService,
        },
        {
          provide: RedisConfigService,
          useValue: mockRedisConfigService,
        },
        {
          provide: HttpCacheInterceptor,
          useValue: {},
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<GameController>(GameController);
    service = module.get<GameService>(GameService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getGames', () => {
    it('should return paginated list of games with proper transformation', async () => {
      const getGamesDto: GetGamesDto = { page: 1, limit: 10 };
      const mockGame = new Game();
      mockGame.id = '123e4567-e89b-12d3-a456-426614174000';
      mockGame.title = 'Test Game';
      mockGame.price = 1999.99;
      mockGame.currency = 'RUB';
      mockGame.available = true;
      mockGame.createdAt = new Date();

      const mockServiceResponse = {
        games: [mockGame],
        total: 1,
        page: 1,
        limit: 10,
        hasNext: false,
      };

      mockGameService.getAllGames.mockResolvedValue(mockServiceResponse);

      const result = await controller.getGames(getGamesDto);

      expect(service.getAllGames).toHaveBeenCalledWith(getGamesDto);
      expect(result).toBeInstanceOf(GameListResponseDto);
      expect(result.games).toHaveLength(1);
      expect(result.games[0]).toBeInstanceOf(GameResponseDto);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should handle empty results', async () => {
      const getGamesDto: GetGamesDto = { page: 1, limit: 10 };
      const mockServiceResponse = {
        games: [],
        total: 0,
        page: 1,
        limit: 10,
        hasNext: false,
      };

      mockGameService.getAllGames.mockResolvedValue(mockServiceResponse);

      const result = await controller.getGames(getGamesDto);

      expect(service.getAllGames).toHaveBeenCalledWith(getGamesDto);
      expect(result.games).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getGameById', () => {
    it('should return game details as GameResponseDto', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const mockGame = new Game();
      mockGame.id = id;
      mockGame.title = 'Test Game';
      mockGame.price = 1999.99;
      mockGame.currency = 'RUB';
      mockGame.available = true;
      mockGame.createdAt = new Date();

      mockGameService.getGameById.mockResolvedValue(mockGame);

      const result = await controller.getGameById(id);

      expect(service.getGameById).toHaveBeenCalledWith(id);
      expect(result).toBeInstanceOf(GameResponseDto);
      expect(result.id).toBe(id);
      expect(result.title).toBe('Test Game');
    });

    it('should propagate service errors', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const error = new Error('Game not found');
      mockGameService.getGameById.mockRejectedValue(error);

      await expect(controller.getGameById(id)).rejects.toThrow(
        'Game not found',
      );
      expect(service.getGameById).toHaveBeenCalledWith(id);
    });
  });

  describe('getGamePurchaseInfo', () => {
    it('should return purchase info for valid game', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const mockPurchaseInfo = new PurchaseInfoDto({
        id,
        title: 'Test Game',
        price: 1999.99,
        currency: 'RUB',
        available: true,
      } as Game);

      mockGameService.getGamePurchaseInfo.mockResolvedValue(mockPurchaseInfo);

      const result = await controller.getGamePurchaseInfo(id);

      expect(service.getGamePurchaseInfo).toHaveBeenCalledWith(id);
      expect(result).toBeInstanceOf(PurchaseInfoDto);
      expect(result.id).toBe(id);
      expect(result.title).toBe('Test Game');
      expect(result.price).toBe(1999.99);
    });

    it('should propagate service errors for unavailable games', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const error = new Error('Game not available for purchase');
      mockGameService.getGamePurchaseInfo.mockRejectedValue(error);

      await expect(controller.getGamePurchaseInfo(id)).rejects.toThrow(
        'Game not available for purchase',
      );
      expect(service.getGamePurchaseInfo).toHaveBeenCalledWith(id);
    });
  });
});
