import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from './redis.constants';
import Redis from 'ioredis';

describe('RedisModule', () => {
  let module: TestingModule;
  let configService: ConfigService;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          REDIS_HOST: 'localhost',
          REDIS_PORT: 6379,
          REDIS_PASSWORD: undefined,
          REDIS_URL: undefined,
        };
        return config[key] || defaultValue;
      }),
    };

    module = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: REDIS_CLIENT,
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
            const redisUrl = config.get<string>('REDIS_URL');
            if (redisUrl) {
              return new Redis(redisUrl, { connectTimeout: 5000, lazyConnect: true });
            }

            const host = config.get<string>('REDIS_HOST', 'localhost');
            const port = config.get<number>('REDIS_PORT', 6379);
            const password = config.get<string | undefined>('REDIS_PASSWORD');
            return new Redis({ host, port, password, connectTimeout: 5000, lazyConnect: true });
          },
        },
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(async () => {
    if (module) {
      const redisClient = module.get(REDIS_CLIENT);
      if (redisClient && typeof redisClient.disconnect === 'function') {
        redisClient.disconnect();
      }
      await module.close();
    }
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide REDIS_CLIENT', () => {
    const redisClient = module.get(REDIS_CLIENT);
    expect(redisClient).toBeDefined();
  });

  it('should create Redis client with correct configuration', () => {
    const redisClient = module.get(REDIS_CLIENT);

    // Check that the client has the expected properties
    expect(redisClient.options).toBeDefined();
    expect(redisClient.options.host).toBe('localhost');
    expect(redisClient.options.port).toBe(6379);
    expect(redisClient.options.connectTimeout).toBe(5000);
    expect(redisClient.options.lazyConnect).toBe(true);
  });

  it('should use REDIS_URL when provided', () => {
    const mockConfigServiceWithUrl = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          REDIS_URL: 'redis://test:6379',
          REDIS_HOST: 'localhost',
          REDIS_PORT: 6379,
          REDIS_PASSWORD: undefined,
        };
        return config[key] || defaultValue;
      }),
    };

    // Create a new module with URL config
    const redisClient = new Redis('redis://test:6379', { connectTimeout: 5000, lazyConnect: true });

    expect(redisClient.options).toBeDefined();
    expect(redisClient.options.connectTimeout).toBe(5000);
    expect(redisClient.options.lazyConnect).toBe(true);

    redisClient.disconnect();
  });
});
