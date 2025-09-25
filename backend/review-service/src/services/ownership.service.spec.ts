import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { of, throwError } from 'rxjs';
import { OwnershipService, ExternalServiceError } from './ownership.service';

describe('OwnershipService', () => {
  let service: OwnershipService;
  let httpService: jest.Mocked<HttpService>;
  let cacheManager: jest.Mocked<Cache>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockHttpService = {
      get: jest.fn(),
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          'LIBRARY_SERVICE_URL': 'http://library-service:3000',
          'OWNERSHIP_REQUEST_TIMEOUT': 5000,
          'OWNERSHIP_MAX_RETRIES': 3,
          'OWNERSHIP_CACHE_TIMEOUT': 600,
          'OWNERSHIP_NEGATIVE_CACHE_TIMEOUT': 300,
        };
        return config[key] || defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnershipService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<OwnershipService>(OwnershipService);
    httpService = module.get(HttpService);
    cacheManager = module.get(CACHE_MANAGER);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkGameOwnership', () => {
    it('should return cached ownership if available', async () => {
      cacheManager.get.mockResolvedValue(true);

      const result = await service.checkGameOwnership('user1', 'game1');

      expect(result).toBe(true);
      expect(cacheManager.get).toHaveBeenCalledWith('ownership_user1_game1');
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('should fetch ownership from library service and cache result', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      httpService.get.mockReturnValue(of({
        data: { owned: true, gameId: 'game1', userId: 'user1' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }));
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.checkGameOwnership('user1', 'game1');

      expect(result).toBe(true);
      expect(httpService.get).toHaveBeenCalledWith(
        'http://library-service:3000/library/user/user1/game/game1',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          }),
        })
      );
      expect(cacheManager.set).toHaveBeenCalledWith('ownership_user1_game1', true, 600);
    });

    it('should return false if game not found in library (404)', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      const error = {
        response: {
          status: 404,
          statusText: 'Not Found',
          headers: {},
          config: {} as any,
          data: null,
        }
      };
      // Mock the observable to return the transformed response for 404
      httpService.get.mockReturnValue(of({
        data: { owned: false, gameId: 'game1', userId: 'user1' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }));
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.checkGameOwnership('user1', 'game1');

      expect(result).toBe(false);
      expect(cacheManager.set).toHaveBeenCalledWith('ownership_user1_game1', false, 300);
    }, 10000);

    it('should return false if library service is unavailable', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      const error = new Error('Service unavailable');
      httpService.get.mockReturnValue(throwError(() => error));
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.checkGameOwnership('user1', 'game1');

      expect(result).toBe(false);
      expect(cacheManager.set).toHaveBeenCalledWith('ownership_user1_game1', false, 60);
    }, 10000);

    it('should handle response without owned property', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      httpService.get.mockReturnValue(of({
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }));
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.checkGameOwnership('user1', 'game1');

      expect(result).toBe(false);
      expect(cacheManager.set).toHaveBeenCalledWith('ownership_user1_game1', false, 300);
    });

    it('should throw error for invalid parameters', async () => {
      await expect(service.checkGameOwnership('', 'game1')).rejects.toThrow('userId and gameId are required');
      await expect(service.checkGameOwnership('user1', '')).rejects.toThrow('userId and gameId are required');
    });

    it('should handle cache errors gracefully', async () => {
      cacheManager.get.mockRejectedValue(new Error('Cache error'));
      httpService.get.mockReturnValue(of({
        data: { owned: true, gameId: 'game1', userId: 'user1' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }));
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.checkGameOwnership('user1', 'game1');

      expect(result).toBe(true);
      expect(httpService.get).toHaveBeenCalled();
    });

    it('should handle external service errors with proper error types', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      const error = {
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          headers: {},
          config: {} as any,
          data: { message: 'Database connection failed' },
        }
      };
      httpService.get.mockReturnValue(throwError(() => error));
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.checkGameOwnership('user1', 'game1');

      expect(result).toBe(false);
      expect(cacheManager.set).toHaveBeenCalledWith('ownership_user1_game1', false, 60);
    }, 10000);
  });

  describe('clearOwnershipCache', () => {
    it('should clear cache for specific user and game', async () => {
      cacheManager.del.mockResolvedValue(true);

      await service.clearOwnershipCache('user1', 'game1');

      expect(cacheManager.del).toHaveBeenCalledWith('ownership_user1_game1');
    });

    it('should handle cache deletion errors gracefully', async () => {
      cacheManager.del.mockRejectedValue(new Error('Cache deletion failed'));

      await expect(service.clearOwnershipCache('user1', 'game1')).resolves.not.toThrow();
    });
  });

  describe('getServiceHealth', () => {
    it('should return healthy status when library service is available', async () => {
      httpService.get.mockReturnValue(of({
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
        data: {},
      }));

      const health = await service.getServiceHealth();

      expect(health).toEqual({
        status: 'healthy',
        libraryService: true,
      });
      expect(httpService.get).toHaveBeenCalledWith('http://library-service:3000/health', { timeout: 2000 });
    });

    it('should return unhealthy status when library service is unavailable', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('Connection refused')));

      const health = await service.getServiceHealth();

      expect(health).toEqual({
        status: 'unhealthy',
        libraryService: false,
      });
    });
  });
});