import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CacheService } from './cache.service';

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
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should return cached value', async () => {
      const key = 'test-key';
      const value = { data: 'test' };
      mockCacheManager.get.mockResolvedValue(value);

      const result = await service.get(key);

      expect(result).toEqual(value);
      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
    });

    it('should return undefined for non-existent key', async () => {
      const key = 'non-existent';
      mockCacheManager.get.mockResolvedValue(undefined);

      const result = await service.get(key);

      expect(result).toBeUndefined();
      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
    });
  });

  describe('set', () => {
    it('should set value with TTL', async () => {
      const key = 'test-key';
      const value = { data: 'test' };
      const ttl = 300;

      await service.set(key, value, ttl);

      expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, ttl);
    });

    it('should set value without TTL', async () => {
      const key = 'test-key';
      const value = { data: 'test' };

      await service.set(key, value);

      expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, undefined);
    });
  });

  describe('del', () => {
    it('should delete cached value', async () => {
      const key = 'test-key';

      await service.del(key);

      expect(mockCacheManager.del).toHaveBeenCalledWith(key);
    });
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
      expect(mockCacheManager.set).not.toHaveBeenCalled();
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

    it('should execute function and set cache without TTL', async () => {
      const key = 'my-key';
      const newData = { value: 'from-function' };
      mockCacheManager.get.mockResolvedValue(undefined);
      const fn = jest.fn().mockResolvedValue(newData);

      const result = await service.getOrSet(key, fn);

      expect(result).toEqual(newData);
      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(mockCacheManager.set).toHaveBeenCalledWith(key, newData, undefined);
    });

    it('should handle function errors', async () => {
      const key = 'my-key';
      const error = new Error('Function failed');
      mockCacheManager.get.mockResolvedValue(undefined);
      const fn = jest.fn().mockRejectedValue(error);

      await expect(service.getOrSet(key, fn, 300)).rejects.toThrow(error);

      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });
  });
});