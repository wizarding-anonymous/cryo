import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { cacheConfig } from './cache.config';

// Mock the redis store import
jest.mock('cache-manager-redis-yet', () => ({
  redisStore: jest.fn().mockResolvedValue({
    name: 'redis',
    isCacheable: () => true,
  }),
}));

describe('Cache Configuration', () => {
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'redis.ttl': 300,
                'redis.host': 'localhost',
                'redis.port': 6379,
                'redis.password': undefined,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
  });

  it('should create cache configuration with Redis store', async () => {
    const config = await cacheConfig.useFactory!(configService);

    expect(config).toBeDefined();
    expect(config.ttl).toBe(300000); // 300 seconds * 1000 = 300000 ms
    expect(config.max).toBe(1000);
    expect(config.isGlobal).toBe(true);
    expect(config.store).toBeDefined();
  });

  it('should handle Redis connection failure gracefully', async () => {
    // Mock redis store to throw an error
    const { redisStore } = await import('cache-manager-redis-yet');
    (redisStore as jest.Mock).mockRejectedValueOnce(
      new Error('Redis connection failed'),
    );

    const config = await cacheConfig.useFactory!(configService);

    expect(config).toBeDefined();
    expect(config.ttl).toBe(300000);
    expect(config.max).toBe(100); // Fallback to smaller cache size
    expect(config.isGlobal).toBe(true);
    expect(config.store).toBeUndefined(); // Should fallback to in-memory
  });

  it('should use default values when config is missing', async () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => defaultValue),
    } as any;

    const config = await cacheConfig.useFactory!(mockConfigService);

    expect(config).toBeDefined();
    expect(config.ttl).toBe(300000); // Default 300 seconds
    expect(mockConfigService.get).toHaveBeenCalledWith('redis.ttl', 300);
    expect(mockConfigService.get).toHaveBeenCalledWith(
      'redis.host',
      'localhost',
    );
    expect(mockConfigService.get).toHaveBeenCalledWith('redis.port', 6379);
  });
});
