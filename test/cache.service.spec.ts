import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CacheService } from '../src/cache/cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let cacheManager: Cache;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrSet', () => {
    it('should return cached data if it exists', async () => {
      const key = 'my-key';
      const cachedData = { value: 'from-cache' };
      mockCacheManager.get.mockResolvedValue(cachedData);
      const fn = jest.fn();

      const result = await service.getOrSet(key, fn, 300);

      expect(result).toEqual(cachedData);
      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should execute function and set cache if data does not exist', async () => {
      const key = 'my-key';
      const newData = { value: 'from-function' };
      mockCacheManager.get.mockResolvedValue(undefined);
      const fn = jest.fn().mockResolvedValue(newData);

      const result = await service.getOrSet(key, fn, 300);

      expect(result).toEqual(newData);
      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(mockCacheManager.set).toHaveBeenCalledWith(key, newData, 300);
    });
  });
});
