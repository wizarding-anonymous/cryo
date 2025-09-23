import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';

import { OwnershipService } from './ownership.service';

describe('OwnershipService', () => {
  let service: OwnershipService;
  let httpService: jest.Mocked<HttpService>;
  let cacheManager: jest.Mocked<Cache>;

  beforeEach(async () => {
    const mockHttpService = {
      get: jest.fn(),
      request: jest.fn(),
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'app.services.library') return 'http://library-service';
        return undefined;
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
  });

  describe('checkGameOwnership', () => {
    it('should return cached result if available', async () => {
      cacheManager.get.mockResolvedValue(true);

      const result = await service.checkGameOwnership('user-123', 'game-456');

      expect(result).toBe(true);
      expect(httpService.request).not.toHaveBeenCalled();
    });

    it('should check ownership via Library Service and cache result', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      httpService.request.mockReturnValue(of({ 
        data: { ownsGame: true }, 
        status: 200, 
        statusText: 'OK', 
        headers: {}, 
        config: {} as any 
      }));
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.checkGameOwnership('user-123', 'game-456');

      expect(result).toBe(true);
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://library-service/api/v1/library/user-123/games/game-456/ownership',
          method: 'GET',
          timeout: 5000,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(cacheManager.set).toHaveBeenCalledWith('ownership_user-123_game-456', true, 600);
    });

    it('should return false if user does not own the game', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      httpService.request.mockReturnValue(of({ 
        data: { ownsGame: false }, 
        status: 200, 
        statusText: 'OK', 
        headers: {}, 
        config: {} as any 
      }));
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.checkGameOwnership('user-123', 'game-456');

      expect(result).toBe(false);
    });

    it('should return false on 404 error', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      const axiosError = {
        isAxiosError: true,
        response: { status: 404 },
      } as AxiosError;
      httpService.request.mockReturnValue(throwError(() => axiosError));
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.checkGameOwnership('user-123', 'game-456');

      expect(result).toBe(false);
    });

    it('should return false on client errors (4xx)', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      const axiosError = {
        isAxiosError: true,
        response: { status: 403 },
      } as AxiosError;
      httpService.request.mockReturnValue(throwError(() => axiosError));
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.checkGameOwnership('user-123', 'game-456');

      expect(result).toBe(false);
    });

    it('should retry on server errors and return false after max retries', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      const axiosError = {
        isAxiosError: true,
        response: { status: 500 },
      } as AxiosError;
      httpService.request.mockReturnValue(throwError(() => axiosError));
      cacheManager.set.mockResolvedValue(undefined);

      // Mock delay to speed up test
      jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);

      const result = await service.checkGameOwnership('user-123', 'game-456');

      expect(result).toBe(false);
      expect(httpService.request).toHaveBeenCalledTimes(3); // MAX_RETRIES
    });
  });

  describe('getUserOwnedGames', () => {
    it('should return list of owned game IDs', async () => {
      const mockResponse = {
        data: {
          games: [
            { gameId: 'game-1', title: 'Game 1' },
            { gameId: 'game-2', title: 'Game 2' },
          ],
        },
      };
      httpService.request.mockReturnValue(of({
        ...mockResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any
      }));

      const result = await service.getUserOwnedGames('user-123');

      expect(result).toEqual(['game-1', 'game-2']);
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://library-service/api/v1/library/user-123/games',
          method: 'GET',
          timeout: 5000,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should return empty array on error', async () => {
      httpService.request.mockReturnValue(throwError(() => new Error('Network error')));

      const result = await service.getUserOwnedGames('user-123');

      expect(result).toEqual([]);
    });

    it('should handle malformed response', async () => {
      httpService.request.mockReturnValue(of({ 
        data: null, 
        status: 200, 
        statusText: 'OK', 
        headers: {}, 
        config: {} as any 
      }));

      const result = await service.getUserOwnedGames('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('invalidateOwnershipCache', () => {
    it('should invalidate cache for specific game', async () => {
      cacheManager.del.mockResolvedValue(true);

      await service.invalidateOwnershipCache('user-123', 'game-456');

      expect(cacheManager.del).toHaveBeenCalledWith('ownership_user-123_game-456');
    });

    it('should log message for user-wide invalidation', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'debug').mockImplementation();

      await service.invalidateOwnershipCache('user-123');

      expect(loggerSpy).toHaveBeenCalledWith('Cache invalidation requested for user user-123');
      loggerSpy.mockRestore();
    });
  });
});