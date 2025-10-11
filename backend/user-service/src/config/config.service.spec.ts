import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './config.service';

describe('AppConfigService', () => {
  let service: AppConfigService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AppConfigService>(AppConfigService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('nodeEnv', () => {
    it('should return NODE_ENV value', () => {
      const mockEnv = 'production';
      const getSpy = jest.spyOn(configService, 'get').mockReturnValue(mockEnv);

      expect(service.nodeEnv).toBe(mockEnv);
      expect(getSpy).toHaveBeenCalledWith('NODE_ENV', {
        infer: true,
      });
    });
  });

  describe('isProduction', () => {
    it('should return true when NODE_ENV is production', () => {
      jest.spyOn(service, 'nodeEnv', 'get').mockReturnValue('production');
      expect(service.isProduction).toBe(true);
    });

    it('should return false when NODE_ENV is not production', () => {
      jest.spyOn(service, 'nodeEnv', 'get').mockReturnValue('development');
      expect(service.isProduction).toBe(false);
    });
  });

  describe('databaseConfig', () => {
    it('should return database configuration object', () => {
      const mockConfig = {
        POSTGRES_HOST: 'localhost',
        POSTGRES_PORT: 5432,
        POSTGRES_USER: 'user',
        POSTGRES_PASSWORD: 'password',
        POSTGRES_DB: 'testdb',
        POSTGRES_MAX_CONNECTIONS: 10,
        POSTGRES_CONNECTION_TIMEOUT: 30000,
      };

      jest
        .spyOn(configService, 'get')
        .mockImplementation((key) => mockConfig[key]);

      const result = service.databaseConfig;

      expect(result).toEqual({
        host: 'localhost',
        port: 5432,
        username: 'user',
        password: 'password',
        database: 'testdb',
        maxConnections: 10,
        connectionTimeout: 30000,
      });
    });
  });

  describe('validateRequiredEnvVars', () => {
    it('should not throw when all required variables are present', () => {
      jest.spyOn(configService, 'get').mockReturnValue('some-value');

      expect(() => service.validateRequiredEnvVars()).not.toThrow();
    });

    it('should throw when required variables are missing', () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);

      expect(() => service.validateRequiredEnvVars()).toThrow(
        'Missing required environment variables:',
      );
    });
  });



  describe('throttleConfig', () => {
    it('should return throttle configuration object', () => {
      const mockConfig = {
        THROTTLE_TTL: 60000,
        THROTTLE_LIMIT: 60,
        RATE_LIMIT_ENABLED: true,
      };

      jest
        .spyOn(configService, 'get')
        .mockImplementation((key) => mockConfig[key]);

      const result = service.throttleConfig;

      expect(result).toEqual({
        ttl: 60000,
        limit: 60,
        enabled: true,
      });
    });
  });
});
