import { Test, TestingModule } from '@nestjs/testing';
import { GameCatalogIntegrationService } from './game-catalog.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { of, throwError } from 'rxjs';
import { GamePurchaseInfo } from './dto/game-purchase-info.dto';

describe('GameCatalogIntegrationService', () => {
  let service: GameCatalogIntegrationService;
  let httpService: HttpService;
  let cacheManager: any;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameCatalogIntegrationService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<GameCatalogIntegrationService>(
      GameCatalogIntegrationService,
    );
    httpService = module.get<HttpService>(HttpService);
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getGamePurchaseInfo', () => {
    const gameId = 'test-game-id';
    const gameInfo: GamePurchaseInfo = {
      id: gameId,
      title: 'Test Game',
      price: 100,
      currency: 'RUB',
      available: true,
    };

    it('should return game info from cache if available', async () => {
      cacheManager.get.mockResolvedValue(gameInfo);
      const result = await service.getGamePurchaseInfo(gameId);
      expect(result).toEqual(gameInfo);
      expect(cacheManager.get).toHaveBeenCalledWith(`game-info-${gameId}`);
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('should fetch from http service and cache the result if not in cache', async () => {
      cacheManager.get.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(
        of({
          data: gameInfo,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }),
      );

      const result = await service.getGamePurchaseInfo(gameId);

      expect(result).toEqual(gameInfo);
      expect(cacheManager.get).toHaveBeenCalledWith(`game-info-${gameId}`);
      expect(httpService.get).toHaveBeenCalledWith(
        'http://mock-game-catalog-url/api/internal/games/test-game-id/purchase-info',
      );
      expect(cacheManager.set).toHaveBeenCalledWith(
        `game-info-${gameId}`,
        gameInfo,
        3600,
      );
    });

    it('should return null if http service throws an error', async () => {
      cacheManager.get.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const result = await service.getGamePurchaseInfo(gameId);
      expect(result).toBeNull();
    });

    it('should return null if response data is null', async () => {
      cacheManager.get.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(
        of({
          data: null,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }),
      );

      const result = await service.getGamePurchaseInfo(gameId);
      expect(result).toBeNull();
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should return null if response is null', async () => {
      cacheManager.get.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(of(null));

      const result = await service.getGamePurchaseInfo(gameId);
      expect(result).toBeNull();
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should handle timeout errors', async () => {
      cacheManager.get.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Timeout')),
      );

      const result = await service.getGamePurchaseInfo(gameId);
      expect(result).toBeNull();
    });

    it('should handle service unavailable errors', async () => {
      cacheManager.get.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Service Unavailable')),
      );

      const result = await service.getGamePurchaseInfo(gameId);
      expect(result).toBeNull();
    });
  });

  describe('checkHealth', () => {
    it('should return status up when service is healthy', async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: { status: 'ok' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }),
      );

      const result = await service.checkHealth();
      expect(result).toEqual({ status: 'up' });
      expect(httpService.get).toHaveBeenCalledWith(
        'http://mock-game-catalog-url/v1/health',
      );
    });

    it('should return status down when service returns non-ok status', async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: { status: 'error' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }),
      );

      const result = await service.checkHealth();
      expect(result).toEqual({ status: 'down' });
    });

    it('should return status down when service is unreachable', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Connection refused')),
      );

      const result = await service.checkHealth();
      expect(result).toEqual({ status: 'down' });
    });

    it('should return status down when service times out', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Timeout')),
      );

      const result = await service.checkHealth();
      expect(result).toEqual({ status: 'down' });
    });
  });
});
