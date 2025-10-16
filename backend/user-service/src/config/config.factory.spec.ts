import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConfigFactory } from './config.factory';
import { EnvironmentVariables } from './env.validation';

describe('ConfigFactory', () => {
  let configFactory: ConfigFactory;
  let configService: ConfigService<EnvironmentVariables>;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    configService =
      module.get<ConfigService<EnvironmentVariables>>(ConfigService);
    configFactory = new ConfigFactory(configService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTypeOrmConfig', () => {
    it('should create TypeORM configuration for development', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          NODE_ENV: 'development',
          POSTGRES_HOST: 'localhost',
          POSTGRES_PORT: 5432,
          POSTGRES_USER: 'test_user',
          POSTGRES_PASSWORD: 'test_password',
          POSTGRES_DB: 'test_db',
          POSTGRES_MAX_CONNECTIONS: 5,
          POSTGRES_CONNECTION_TIMEOUT: 10000,
        };
        return config[key];
      });

      const typeOrmConfig = configFactory.createTypeOrmConfig();

      expect(typeOrmConfig).toMatchObject({
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'test_user',
        password: 'test_password',
        database: 'test_db',
        synchronize: false,
      });
      expect(typeOrmConfig.extra.ssl).toBe(false);
      expect(typeOrmConfig.extra.max).toBe(5);
    });

    it('should create TypeORM configuration for production with SSL', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          NODE_ENV: 'production',
          POSTGRES_HOST: 'prod-host',
          POSTGRES_PORT: 5432,
          POSTGRES_USER: 'prod_user',
          POSTGRES_PASSWORD: 'prod_password',
          POSTGRES_DB: 'prod_db',
          POSTGRES_MAX_CONNECTIONS: 20,
          POSTGRES_CONNECTION_TIMEOUT: 30000,
        };
        return config[key];
      });

      const typeOrmConfig = configFactory.createTypeOrmConfig();

      expect(typeOrmConfig).toMatchObject({
        type: 'postgres',
        host: 'prod-host',
      });
      expect(typeOrmConfig.extra.ssl).toEqual({
        rejectUnauthorized: false,
        sslmode: 'require',
      });
      expect(typeOrmConfig.extra.max).toBe(20);
    });
  });

  describe('createThrottlerConfig', () => {
    it('should create throttler configuration when rate limiting is enabled', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          THROTTLE_TTL: 60000,
          THROTTLE_LIMIT: 100,
          RATE_LIMIT_ENABLED: true,
        };
        return config[key];
      });

      const throttlerConfig = configFactory.createThrottlerConfig();

      expect(throttlerConfig).toEqual({
        throttlers: [
          {
            name: 'default',
            ttl: 60000,
            limit: 100,
          },
        ],
      });
    });

    it('should create high-limit throttler configuration when rate limiting is disabled', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          THROTTLE_TTL: 60000,
          THROTTLE_LIMIT: 100,
          RATE_LIMIT_ENABLED: false,
        };
        return config[key];
      });

      const throttlerConfig = configFactory.createThrottlerConfig();

      expect(throttlerConfig).toEqual({
        throttlers: [
          {
            name: 'default',
            ttl: 60000,
            limit: 10000,
          },
        ],
      });
    });
  });

  describe('createCacheConfig', () => {
    it('should create cache configuration for development', () => {
      mockConfigService.get.mockReturnValue('development');

      const cacheConfig = configFactory.createCacheConfig();

      expect(cacheConfig).toEqual({
        isGlobal: true,
        ttl: 60,
        max: 100,
      });
    });

    it('should create cache configuration for production', () => {
      mockConfigService.get.mockReturnValue('production');

      const cacheConfig = configFactory.createCacheConfig();

      expect(cacheConfig).toEqual({
        isGlobal: true,
        ttl: 300,
        max: 1000,
      });
    });
  });

  describe('createRedisConfig', () => {
    it('should create Redis configuration', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          REDIS_HOST: 'localhost',
          REDIS_PORT: 6379,
          REDIS_PASSWORD: 'password',
          REDIS_DB: 0,
          REDIS_MAX_RETRIES: 3,
          REDIS_RETRY_DELAY: 1000,
        };
        return config[key];
      });

      const redisConfig = configFactory.createRedisConfig();

      expect(redisConfig).toMatchObject({
        host: 'localhost',
        port: 6379,
        password: 'password',
        db: 0,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 1000,
        lazyConnect: true,
      });
    });
  });

  describe('createCorsConfig', () => {
    it('should create CORS configuration with wildcard origin', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          CORS_ORIGIN: '*',
          CORS_METHODS: 'GET,POST,PUT,DELETE',
          CORS_CREDENTIALS: true,
        };
        return config[key];
      });

      const corsConfig = configFactory.createCorsConfig();

      expect(corsConfig).toEqual({
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true,
        optionsSuccessStatus: 200,
      });
    });

    it('should create CORS configuration with specific origins', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          CORS_ORIGIN: 'https://example.com,https://app.example.com',
          CORS_METHODS: 'GET,POST',
          CORS_CREDENTIALS: false,
        };
        return config[key];
      });

      const corsConfig = configFactory.createCorsConfig();

      expect(corsConfig).toEqual({
        origin: ['https://example.com', 'https://app.example.com'],
        methods: ['GET', 'POST'],
        credentials: false,
        optionsSuccessStatus: 200,
      });
    });
  });

  describe('createSwaggerConfig', () => {
    it('should create Swagger configuration for development', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          SERVICE_NAME: 'user-service',
          SERVICE_VERSION: '1.0.0',
          NODE_ENV: 'development',
        };
        return config[key];
      });

      const swaggerConfig = configFactory.createSwaggerConfig();

      expect(swaggerConfig).toEqual({
        title: 'User-service API',
        description: 'API documentation for the user-service microservice',
        version: '1.0.0',
        enabled: true,
      });
    });

    it('should disable Swagger for production', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          SERVICE_NAME: 'user-service',
          SERVICE_VERSION: '1.0.0',
          NODE_ENV: 'production',
        };
        return config[key];
      });

      const swaggerConfig = configFactory.createSwaggerConfig();

      expect(swaggerConfig.enabled).toBe(false);
    });
  });

  describe('validateConfiguration', () => {
    it('should pass validation with all required variables', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          POSTGRES_HOST: 'localhost',
          POSTGRES_USER: 'user',
          POSTGRES_PASSWORD: 'password',
          POSTGRES_DB: 'db',
          REDIS_HOST: 'localhost',
          NODE_ENV: 'development',
        };
        return config[key];
      });

      expect(() => configFactory.validateConfiguration()).not.toThrow();
    });

    it('should throw error for missing required variables', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          POSTGRES_HOST: 'localhost',
          // Missing other required variables
        };
        return config[key];
      });

      expect(() => configFactory.validateConfiguration()).toThrow(
        'Missing required environment variables',
      );
    });

    it('should validate production-specific configuration', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          POSTGRES_HOST: 'localhost',
          POSTGRES_USER: 'user',
          POSTGRES_PASSWORD: 'CHANGE_ME_IN_PRODUCTION', // Default value
          POSTGRES_DB: 'db',
          REDIS_HOST: 'localhost',
          NODE_ENV: 'production',
        };
        return config[key];
      });

      expect(() => configFactory.validateConfiguration()).toThrow(
        'POSTGRES_PASSWORD must be changed from default value in production',
      );
    });
  });
});
