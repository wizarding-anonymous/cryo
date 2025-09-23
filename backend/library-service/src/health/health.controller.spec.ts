import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService, TypeOrmHealthIndicator, MicroserviceHealthIndicator } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { RedisHealthIndicator } from './redis.health';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;

  const mockHealthCheckService = {
    check: jest.fn(),
  };

  const mockTypeOrmHealthIndicator = {
    pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
  };

  const mockMicroserviceHealthIndicator = {
    pingCheck: jest.fn().mockResolvedValue({ 'game-catalog-service': { status: 'up' } }),
  };

  const mockRedisHealthIndicator = {
    isHealthy: jest.fn().mockResolvedValue({ redis: { status: 'up' } }),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'services.gamesCatalog.url') {
        return 'http://localhost:3001';
      }
      return 'mock-value';
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: TypeOrmHealthIndicator, useValue: mockTypeOrmHealthIndicator },
        { provide: MicroserviceHealthIndicator, useValue: mockMicroserviceHealthIndicator },
        { provide: RedisHealthIndicator, useValue: mockRedisHealthIndicator },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should perform health checks', async () => {
      // Set NODE_ENV to test to simulate test environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const mockHealthResult = {
        status: 'ok',
        info: {
          database: { status: 'up' },
        },
        error: {},
        details: {
          database: { status: 'up' },
        },
      };

      mockHealthCheckService.check.mockImplementation((checks) => {
        // Execute the check functions to ensure they're called properly
        return Promise.all(checks.map((check: () => Promise<unknown>) => check())).then(() => mockHealthResult);
      });

      const result = await controller.check();

      expect(result).toEqual(mockHealthResult);
      expect(mockTypeOrmHealthIndicator.pingCheck).toHaveBeenCalledWith('database', { timeout: 300 });
      // In test environment, Redis and microservice checks should not be called
      expect(mockRedisHealthIndicator.isHealthy).not.toHaveBeenCalled();
      expect(mockMicroserviceHealthIndicator.pingCheck).not.toHaveBeenCalled();

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle health check failures', async () => {
      // Set NODE_ENV to test to simulate test environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const mockHealthResult = {
        status: 'error',
        info: {},
        error: {
          database: { status: 'down', message: 'Connection failed' },
        },
        details: {
          database: { status: 'down', message: 'Connection failed' },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(mockHealthResult);

      const result = await controller.check();

      expect(result).toEqual(mockHealthResult);
      expect(result.status).toBe('error');

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });

    it('should call health check service with correct parameters', async () => {
      // Set NODE_ENV to test to simulate test environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const mockHealthResult = { status: 'ok', info: {}, error: {}, details: {} };
      mockHealthCheckService.check.mockResolvedValue(mockHealthResult);

      await controller.check();

      // In test environment, only database check should be performed
      expect(mockHealthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
      ]);

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });

    it('should perform all health checks in non-test environment', async () => {
      // Set NODE_ENV to production to simulate non-test environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockHealthResult = {
        status: 'ok',
        info: {
          database: { status: 'up' },
          redis: { status: 'up' },
          'game-catalog-service': { status: 'up' },
        },
        error: {},
        details: {
          database: { status: 'up' },
          redis: { status: 'up' },
          'game-catalog-service': { status: 'up' },
        },
      };

      mockHealthCheckService.check.mockImplementation((checks) => {
        // Execute the check functions to ensure they're called properly
        return Promise.all(checks.map((check: () => Promise<unknown>) => check())).then(() => mockHealthResult);
      });

      const result = await controller.check();

      expect(result).toEqual(mockHealthResult);
      expect(mockTypeOrmHealthIndicator.pingCheck).toHaveBeenCalledWith('database', { timeout: 300 });
      expect(mockRedisHealthIndicator.isHealthy).toHaveBeenCalledWith('redis');
      expect(mockMicroserviceHealthIndicator.pingCheck).toHaveBeenCalledWith('game-catalog-service', expect.any(Object));

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });
  });
});
