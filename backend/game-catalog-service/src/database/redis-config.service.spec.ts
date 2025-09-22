import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisConfigService } from './redis-config.service';

describe('RedisConfigService', () => {
  let service: RedisConfigService;
  let configService: ConfigService;

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
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RedisConfigService>(RedisConfigService);
    configService = module.get<ConfigService>(ConfigService);
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
    expect(connectionInfo).toBe('localhost:6379');
  });

  it('should create cache key with prefix', () => {
    const cacheKey = service.createCacheKey('games', 'test-id');
    expect(cacheKey).toBe('game-catalog:games:test-id');
  });

  it('should fail validation with missing config', () => {
    const mockConfigService = {
      get: jest.fn(() => undefined),
    };
    
    const testService = new RedisConfigService(mockConfigService as any);
    const isValid = testService.validateConfig();
    
    expect(isValid).toBe(false);
  });

  it('should create cache options with fallback', async () => {
    // Mock the dynamic import to fail
    jest.doMock('cache-manager-redis-store', () => {
      throw new Error('Redis not available');
    });

    const options = await service.createCacheOptions();
    
    expect(options).toBeDefined();
    expect(options.ttl).toBe(300);
    expect(options.isGlobal).toBe(true);
  });
});