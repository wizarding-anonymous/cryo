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
        return Promise.all(checks.map(check => check())).then(() => mockHealthResult);
      });

      const result = await controller.check();

      expect(result).toEqual(mockHealthResult);
      expect(mockTypeOrmHealthIndicator.pingCheck).toHaveBeenCalledWith('database', { timeout: 300 });
      expect(mockRedisHealthIndicator.isHealthy).toHaveBeenCalledWith('redis');
      expect(mockMicroserviceHealthIndicator.pingCheck).toHaveBeenCalledWith('game-catalog-service', expect.any(Object));
    });

    it('should handle health check failures', async () => {
      const mockHealthResult = {
        status: 'error',
        info: {
          redis: { status: 'up' },
        },
        error: {
          database: { status: 'down', message: 'Connection failed' },
          'game-catalog-service': { status: 'down', message: 'Service unavailable' },
        },
        details: {
          database: { status: 'down', message: 'Connection failed' },
          redis: { status: 'up' },
          'game-catalog-service': { status: 'down', message: 'Service unavailable' },
        },
      };

      mockTypeOrmHealthIndicator.pingCheck.mockRejectedValueOnce(new Error('Connection failed'));
      mockMicroserviceHealthIndicator.pingCheck.mockRejectedValueOnce(new Error('Service unavailable'));

      mockHealthCheckService.check.mockResolvedValue(mockHealthResult);

      const result = await controller.check();

      expect(result).toEqual(mockHealthResult);
      expect(result.status).toBe('error');
    });

    it('should call health check service with correct parameters', async () => {
      const mockHealthResult = { status: 'ok', info: {}, error: {}, details: {} };
      mockHealthCheckService.check.mockResolvedValue(mockHealthResult);

      await controller.check();

      expect(mockHealthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      ]);
    });
  });
});
