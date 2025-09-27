import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { of, throwError } from 'rxjs';
import { GameCatalogIntegrationService } from './game-catalog.service';
import { OrderService } from '../../modules/order/order.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from '../../modules/order/entities/order.entity';
import { BadRequestException } from '@nestjs/common';

describe('Game Catalog Integration with Order Service', () => {
  let orderService: OrderService;
  let gameCatalogService: GameCatalogIntegrationService;
  let httpService: HttpService;
  let orderRepository: any;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://mock-game-catalog-url'),
  };

  const mockOrderRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        GameCatalogIntegrationService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: getRepositoryToken(Order), useValue: mockOrderRepository },
      ],
    }).compile();

    orderService = module.get<OrderService>(OrderService);
    gameCatalogService = module.get<GameCatalogIntegrationService>(
      GameCatalogIntegrationService,
    );
    httpService = module.get<HttpService>(HttpService);
    orderRepository = module.get(getRepositoryToken(Order));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Order Creation with Game Validation', () => {
    const userId = 'test-user-123';
    const gameId = 'test-game-456';
    const gameInfo = {
      id: gameId,
      title: 'Test Game',
      price: 1500,
      currency: 'RUB',
      available: true,
    };

    it('should create order successfully when game exists and is available', async () => {
      // Mock cache miss and successful HTTP response
      mockCacheManager.get.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(
        of({
          data: gameInfo,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }),
      );

      // Mock repository operations
      const mockOrder = {
        id: 'order-123',
        userId,
        gameId,
        gameName: gameInfo.title,
        amount: gameInfo.price,
        currency: gameInfo.currency,
        status: 'pending',
      };
      mockOrderRepository.create.mockReturnValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue(mockOrder);

      const result = await orderService.createOrder({ gameId }, userId);

      expect(result).toEqual(mockOrder);
      expect(mockHttpService.get).toHaveBeenCalledWith(
        'http://mock-game-catalog-url/api/internal/games/test-game-456/purchase-info',
      );
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `game-info-${gameId}`,
        gameInfo,
        3600,
      );
      expect(mockOrderRepository.create).toHaveBeenCalledWith({
        userId,
        gameId,
        gameName: gameInfo.title,
        amount: gameInfo.price,
        currency: gameInfo.currency,
        status: 'pending',
        expiresAt: expect.any(Date),
      });
    });

    it('should throw BadRequestException when game does not exist', async () => {
      // Mock cache miss and HTTP error
      mockCacheManager.get.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Game not found')),
      );

      await expect(
        orderService.createOrder({ gameId }, userId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        orderService.createOrder({ gameId }, userId),
      ).rejects.toThrow('could not be found');

      expect(mockOrderRepository.create).not.toHaveBeenCalled();
      expect(mockOrderRepository.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when game is not available', async () => {
      const unavailableGameInfo = { ...gameInfo, available: false };

      // Mock cache miss and HTTP response with unavailable game
      mockCacheManager.get.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(
        of({
          data: unavailableGameInfo,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }),
      );

      await expect(
        orderService.createOrder({ gameId }, userId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        orderService.createOrder({ gameId }, userId),
      ).rejects.toThrow('not available for purchase');

      expect(mockOrderRepository.create).not.toHaveBeenCalled();
      expect(mockOrderRepository.save).not.toHaveBeenCalled();
    });

    it('should use cached game info on second request', async () => {
      // Mock cache hit
      mockCacheManager.get.mockResolvedValue(gameInfo);

      // Mock repository operations
      const mockOrder = {
        id: 'order-123',
        userId,
        gameId,
        gameName: gameInfo.title,
        amount: gameInfo.price,
        currency: gameInfo.currency,
        status: 'pending',
      };
      mockOrderRepository.create.mockReturnValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue(mockOrder);

      const result = await orderService.createOrder({ gameId }, userId);

      expect(result).toEqual(mockOrder);
      expect(mockCacheManager.get).toHaveBeenCalledWith(`game-info-${gameId}`);
      expect(mockHttpService.get).not.toHaveBeenCalled();
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('should handle service timeout gracefully', async () => {
      // Mock cache miss and timeout error
      mockCacheManager.get.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Timeout')),
      );

      await expect(
        orderService.createOrder({ gameId }, userId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        orderService.createOrder({ gameId }, userId),
      ).rejects.toThrow('could not be found');
    });

    it('should handle service unavailable gracefully', async () => {
      // Mock cache miss and service unavailable error
      mockCacheManager.get.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Service Unavailable')),
      );

      await expect(
        orderService.createOrder({ gameId }, userId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        orderService.createOrder({ gameId }, userId),
      ).rejects.toThrow('could not be found');
    });
  });

  describe('Game Catalog Service Health Check', () => {
    it('should return up status when service is healthy', async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: { status: 'ok' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }),
      );

      const result = await gameCatalogService.checkHealth();
      expect(result).toEqual({ status: 'up' });
    });

    it('should return down status when service is unhealthy', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Service Unavailable')),
      );

      const result = await gameCatalogService.checkHealth();
      expect(result).toEqual({ status: 'down' });
    });
  });
});