import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRedisConfig } from './redis.config';

describe('RedisConfig', () => {
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                REDIS_HOST: 'localhost',
                REDIS_PORT: 6379,
                REDIS_PASSWORD: 'test-password',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
  });

  it('should return correct Redis configuration', () => {
    const config = getRedisConfig(configService);

    expect(config.store).toBeDefined();
    expect(config.host).toBe('localhost');
    expect(config.port).toBe(6379);
    expect(config.password).toBe('test-password');
    expect(config.ttl).toBe(300);
    expect(config.max).toBe(1000);
    expect(config.db).toBe(0);
    expect(config.keyPrefix).toBe('social-service:');
    expect(config.retryDelayOnFailover).toBe(100);
    expect(config.enableReadyCheck).toBe(true);
    expect(config.maxRetriesPerRequest).toBe(3);
  });

  it('should use default values when environment variables are not set', () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => defaultValue),
    } as any;

    const config = getRedisConfig(mockConfigService);

    expect(config.host).toBe('localhost');
    expect(config.port).toBe(6379);
    expect(config.password).toBeUndefined();
  });
});
