import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CircuitBreakerConfig } from './circuit-breaker.config';

describe('CircuitBreakerConfig', () => {
  let service: CircuitBreakerConfig;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerConfig,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                CIRCUIT_BREAKER_TIMEOUT: 3000,
                CIRCUIT_BREAKER_ERROR_THRESHOLD: 50,
                CIRCUIT_BREAKER_RESET_TIMEOUT: 30000,
                CIRCUIT_BREAKER_ROLLING_TIMEOUT: 10000,
                CIRCUIT_BREAKER_ROLLING_BUCKETS: 10,
                CIRCUIT_BREAKER_VOLUME_THRESHOLD: 10,
                USER_SERVICE_CIRCUIT_BREAKER_TIMEOUT: 3000,
                USER_SERVICE_CIRCUIT_BREAKER_ERROR_THRESHOLD: 50,
                USER_SERVICE_CIRCUIT_BREAKER_RESET_TIMEOUT: 30000,
                SECURITY_SERVICE_CIRCUIT_BREAKER_TIMEOUT: 5000,
                SECURITY_SERVICE_CIRCUIT_BREAKER_ERROR_THRESHOLD: 60,
                SECURITY_SERVICE_CIRCUIT_BREAKER_RESET_TIMEOUT: 60000,
                SECURITY_SERVICE_CIRCUIT_BREAKER_VOLUME_THRESHOLD: 5,
                NOTIFICATION_SERVICE_CIRCUIT_BREAKER_TIMEOUT: 5000,
                NOTIFICATION_SERVICE_CIRCUIT_BREAKER_ERROR_THRESHOLD: 70,
                NOTIFICATION_SERVICE_CIRCUIT_BREAKER_RESET_TIMEOUT: 60000,
                NOTIFICATION_SERVICE_CIRCUIT_BREAKER_VOLUME_THRESHOLD: 3,
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CircuitBreakerConfig>(CircuitBreakerConfig);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDefaultConfig', () => {
    it('should return default circuit breaker configuration', () => {
      const config = service.getDefaultConfig();

      expect(config).toEqual({
        timeout: 3000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        volumeThreshold: 10,
      });
    });

    it('should use default values when environment variables are not set', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => defaultValue);

      const config = service.getDefaultConfig();

      expect(config.timeout).toBe(3000);
      expect(config.errorThresholdPercentage).toBe(50);
      expect(config.resetTimeout).toBe(30000);
    });
  });

  describe('getUserServiceConfig', () => {
    it('should return User Service specific configuration', () => {
      const config = service.getUserServiceConfig();

      expect(config.name).toBe('UserService');
      expect(config.timeout).toBe(3000);
      expect(config.errorThresholdPercentage).toBe(50);
      expect(config.resetTimeout).toBe(30000);
    });
  });

  describe('getSecurityServiceConfig', () => {
    it('should return Security Service specific configuration', () => {
      const config = service.getSecurityServiceConfig();

      expect(config.name).toBe('SecurityService');
      expect(config.timeout).toBe(5000);
      expect(config.errorThresholdPercentage).toBe(60);
      expect(config.resetTimeout).toBe(60000);
      expect(config.volumeThreshold).toBe(5);
    });
  });

  describe('getNotificationServiceConfig', () => {
    it('should return Notification Service specific configuration', () => {
      const config = service.getNotificationServiceConfig();

      expect(config.name).toBe('NotificationService');
      expect(config.timeout).toBe(5000);
      expect(config.errorThresholdPercentage).toBe(70);
      expect(config.resetTimeout).toBe(60000);
      expect(config.volumeThreshold).toBe(3);
    });
  });
});