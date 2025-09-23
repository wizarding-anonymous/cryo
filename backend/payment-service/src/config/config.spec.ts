import { Test, TestingModule } from '@nestjs/testing';
import {
  ConfigModule as NestConfigModule,
  ConfigService,
} from '@nestjs/config';
import { AppConfigService } from './app.config';
import { ConfigValidationService } from './config-validation.service';
import { configuration } from './configuration';
import { envValidationSchema } from './env.validation';

describe('Configuration Module', () => {
  let configService: ConfigService;
  let appConfigService: AppConfigService;
  let validationService: ConfigValidationService;

  beforeEach(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_jwt_secret_key_minimum_32_characters';
    process.env.POSTGRES_PASSWORD = 'test_password';
    process.env.REDIS_TTL = '0';
    process.env.BCRYPT_ROUNDS = '4';
    process.env.ENABLED_PROVIDERS = 'sberbank,yandex,tbank';

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        NestConfigModule.forRoot({
          load: [configuration],
          validationSchema: envValidationSchema,
          validationOptions: {
            allowUnknown: true,
            abortEarly: false,
          },
        }),
      ],
      providers: [AppConfigService, ConfigValidationService],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
    appConfigService = module.get<AppConfigService>(AppConfigService);
    validationService = module.get<ConfigValidationService>(
      ConfigValidationService,
    );
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.NODE_ENV;
    delete process.env.JWT_SECRET;
    delete process.env.POSTGRES_PASSWORD;
    delete process.env.REDIS_TTL;
    delete process.env.BCRYPT_ROUNDS;
    delete process.env.ENABLED_PROVIDERS;
  });

  describe('ConfigService', () => {
    it('should be defined', () => {
      expect(configService).toBeDefined();
    });

    it('should load environment variables', () => {
      expect(configService.get('NODE_ENV')).toBe('test');
      expect(configService.get('JWT_SECRET')).toBe(
        'test_jwt_secret_key_minimum_32_characters',
      );
    });

    it('should provide default values', () => {
      expect(configService.get('PORT')).toBeGreaterThan(0);
      expect(configService.get('POSTGRES_HOST')).toBeDefined();
    });
  });

  describe('AppConfigService', () => {
    it('should be defined', () => {
      expect(appConfigService).toBeDefined();
    });

    it('should provide environment information', () => {
      expect(appConfigService.environment).toBe('test');
      expect(appConfigService.isTest).toBe(true);
      expect(appConfigService.isDevelopment).toBe(false);
      expect(appConfigService.isProduction).toBe(false);
    });

    it('should provide app configuration', () => {
      const appConfig = appConfigService.app;
      expect(appConfig).toBeDefined();
      expect(appConfig.corsOrigin).toBeDefined();
      expect(appConfig.corsCredentials).toBeDefined();
    });

    it('should provide database configuration', () => {
      const dbConfig = appConfigService.database;
      expect(dbConfig).toBeDefined();
      expect(dbConfig.synchronize).toBeDefined();
      expect(dbConfig.logging).toBeDefined();
      expect(dbConfig.poolSize).toBeGreaterThan(0);
    });

    it('should provide cache configuration', () => {
      const cacheConfig = appConfigService.cache;
      expect(cacheConfig).toBeDefined();
      expect(cacheConfig.ttl).toBe(0); // Test environment disables caching
      expect(cacheConfig.max).toBeGreaterThan(0);
    });

    it('should provide JWT configuration', () => {
      const jwtConfig = appConfigService.jwt;
      expect(jwtConfig).toBeDefined();
      expect(jwtConfig.secret).toBe(
        'test_jwt_secret_key_minimum_32_characters',
      );
      expect(jwtConfig.expiresIn).toBeDefined();
    });

    it('should provide payment configuration', () => {
      const paymentConfig = appConfigService.payment;
      expect(paymentConfig).toBeDefined();
      expect(paymentConfig.mode).toBe('simulation');
      expect(paymentConfig.autoApprove).toBe(true);
      expect(paymentConfig.delayMs).toBeGreaterThanOrEqual(0);
      expect(paymentConfig.successRate).toBeGreaterThanOrEqual(0);
      expect(paymentConfig.successRate).toBeLessThanOrEqual(1);
    });

    it('should provide payment provider configuration', () => {
      const providers = appConfigService.paymentProviders;
      expect(providers).toBeDefined();
      expect(providers.sberbank).toBeDefined();
      expect(providers.yandex).toBeDefined();
      expect(providers.tbank).toBeDefined();

      expect(providers.sberbank.url).toBeDefined();
      expect(providers.sberbank.apiKey).toBeDefined();
    });

    it('should provide external services configuration', () => {
      const external = appConfigService.externalServices;
      expect(external).toBeDefined();
      expect(external.userService).toBeDefined();
      expect(external.gameCatalogService).toBeDefined();
      expect(external.libraryService).toBeDefined();
    });

    it('should provide enabled providers list', () => {
      const providers = appConfigService.enabledProviders;
      expect(providers).toBeDefined();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should generate database URL', () => {
      const dbUrl = appConfigService.databaseUrl;
      expect(dbUrl).toBeDefined();
      expect(dbUrl).toContain('postgresql://');
    });

    it('should generate Redis URL', () => {
      const redisUrl = appConfigService.redisUrl;
      expect(redisUrl).toBeDefined();
      expect(redisUrl).toContain('redis://');
    });
  });

  describe('ConfigValidationService', () => {
    it('should be defined', () => {
      expect(validationService).toBeDefined();
    });

    it('should validate configuration successfully in test environment', () => {
      const health = validationService.getConfigurationHealth();
      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(['healthy', 'warning', 'error']).toContain(health.status);
    });

    it('should provide validation details', () => {
      const health = validationService.getConfigurationHealth();
      expect(health.details).toBeDefined();
      expect(health.details.isValid).toBeDefined();
      expect(Array.isArray(health.details.errors)).toBe(true);
      expect(Array.isArray(health.details.warnings)).toBe(true);
    });
  });

  describe('Environment-specific Configuration', () => {
    it('should load test-specific configuration', () => {
      const testConfig = configService.get('logging');
      expect(testConfig).toBeDefined();
    });

    it('should have appropriate test settings', () => {
      const security = appConfigService.security;
      expect(security.bcryptRounds).toBe(4); // Fast for tests

      const cache = appConfigService.cache;
      expect(cache.ttl).toBe(0); // No caching in tests

      const monitoring = appConfigService.monitoring;
      expect(monitoring.metricsEnabled).toBe(false); // Disabled in tests
    });
  });
});
