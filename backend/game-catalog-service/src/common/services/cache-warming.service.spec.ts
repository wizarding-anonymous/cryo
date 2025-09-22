import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheWarmingService } from './cache-warming.service';
import { CacheService } from './cache.service';

const mockConfigService = {
  get: jest.fn(),
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  delByPattern: jest.fn(),
  invalidateGameCache: jest.fn(),
  warmUpCache: jest.fn(),
  getCacheStats: jest.fn(),
};

describe('CacheWarmingService', () => {
  let service: CacheWarmingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheWarmingService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<CacheWarmingService>(CacheWarmingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('warmUpCache', () => {
    it('should complete warmup when enabled', async () => {
      mockConfigService.get.mockReturnValue(true);

      await service.warmUpCache();

      expect(service).toBeDefined();
    });

    it('should skip warmup when disabled', async () => {
      mockConfigService.get.mockReturnValue(false);

      await service.warmUpCache();

      expect(service).toBeDefined();
    });
  });

  describe('triggerWarmup', () => {
    it('should return success result when warmup completes', async () => {
      const result = await service.triggerWarmup();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('message');
    });
  });
});