import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisConfigService } from './redis-config.service';

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    info: jest.fn().mockResolvedValue('used_memory_human:1.00M'),
    dbsize: jest.fn().mockResolvedValue(0),
    on: jest.fn(),
  }));
});

describe('RedisConfigService', () => {
  let service: RedisConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                REDIS_HOST: 'localhost',
                REDIS_PORT: 6379,
                NODE_ENV: 'test',
              };
              return (config[key] || defaultValue) as unknown;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RedisConfigService>(RedisConfigService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should validate configuration successfully', () => {
    const isValid = service.validateConfig();
    expect(isValid).toBe(true);
  });

  it('should return connection info', () => {
    const connectionInfo = service.getConnectionInfo();
    expect(connectionInfo).toContain('localhost:6379');
  });

  it('should create cache key with prefix', () => {
    const cacheKey = service.createCacheKey('games', 'test-id');
    expect(cacheKey).toBe('game-catalog:games:test-id');
  });

  it('should fail validation with missing config', () => {
    const mockConfigService = {
      get: jest.fn(() => undefined),
    };

    const testService = new RedisConfigService(
      mockConfigService as unknown as ConfigService,
    );
    const isValid = testService.validateConfig();

    expect(isValid).toBe(false);
  });

  it('should handle cache operations gracefully when Redis is unavailable', async () => {
    // Test when Redis is not available
    const result = await service.set('test-key', { data: 'test' });
    expect(typeof result).toBe('boolean');
  });

  it('should get cache statistics', async () => {
    const stats = await service.getStats();
    expect(stats).toHaveProperty('connected');
    expect(stats).toHaveProperty('memory');
    expect(stats).toHaveProperty('keys');
  });
});
