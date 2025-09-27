import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { StartupValidationService } from '../config/startup-validation.service';
import { AppConfigService } from '../config/config.service';
import { RedisService } from '../common/redis/redis.service';

// Mock implementations for all dependencies
const mockHealthCheckService = {
  check: jest.fn(),
};

const mockTypeOrmHealthIndicator = {
  pingCheck: jest.fn(),
};

const mockMemoryHealthIndicator = {
  checkHeap: jest.fn(),
  checkRSS: jest.fn(),
};

const mockStartupValidationService = {
  performHealthCheck: jest.fn(),
};

const mockAppConfigService = {
  healthCheckTimeout: 5000,
  serviceName: 'user-service',
  serviceVersion: '1.0.0',
  nodeEnv: 'test',
};

const mockRedisService = {
  healthCheck: jest.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;
  let startupValidationService: StartupValidationService;
  let redisService: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        {
          provide: TypeOrmHealthIndicator,
          useValue: mockTypeOrmHealthIndicator,
        },
        { provide: MemoryHealthIndicator, useValue: mockMemoryHealthIndicator },
        {
          provide: StartupValidationService,
          useValue: mockStartupValidationService,
        },
        { provide: AppConfigService, useValue: mockAppConfigService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
    startupValidationService = module.get<StartupValidationService>(
      StartupValidationService,
    );
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should perform health checks and return results', async () => {
      const mockHealthResult = {
        status: 'ok',
        info: { database: { status: 'up' } },
        error: {},
        details: { database: { status: 'up' } },
      };

      mockHealthCheckService.check.mockResolvedValue(mockHealthResult);
      mockRedisService.healthCheck.mockResolvedValue(true);
      mockStartupValidationService.performHealthCheck.mockResolvedValue({
        status: 'ok',
        checks: {
          database: { status: 'pass', message: 'Database is healthy' },
          environment: { status: 'pass', message: 'Environment is valid' },
        },
      });

      const result = await controller.check();

      expect(healthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      ]);
      expect(result).toEqual(mockHealthResult);
    });

    it('should handle Redis health check failure gracefully', async () => {
      const mockHealthResult = {
        status: 'ok',
        info: { database: { status: 'up' } },
        error: {},
        details: { database: { status: 'up' } },
      };

      mockHealthCheckService.check.mockResolvedValue(mockHealthResult);
      mockRedisService.healthCheck.mockResolvedValue(false);
      mockStartupValidationService.performHealthCheck.mockResolvedValue({
        status: 'ok',
        checks: {
          database: { status: 'pass', message: 'Database is healthy' },
          environment: { status: 'pass', message: 'Environment is valid' },
        },
      });

      const result = await controller.check();

      expect(result).toEqual(mockHealthResult);
    });
  });

  describe('detailedCheck', () => {
    it('should return detailed health information', async () => {
      const mockValidationResult = {
        status: 'ok',
        checks: {
          database: { status: 'pass', message: 'Database is healthy' },
          environment: { status: 'pass', message: 'Environment is valid' },
        },
      };

      mockStartupValidationService.performHealthCheck.mockResolvedValue(
        mockValidationResult,
      );

      const result = await controller.detailedCheck();

      expect(startupValidationService.performHealthCheck).toHaveBeenCalled();
      expect(result).toMatchObject({
        service: 'user-service',
        version: '1.0.0',
        environment: 'test',
        status: 'ok',
        checks: mockValidationResult.checks,
      });
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('performRedisHealthCheck', () => {
    it('should return healthy status when Redis is up', async () => {
      mockRedisService.healthCheck.mockResolvedValue(true);

      // Access the private method through reflection for testing
      const result = await (controller as any).performRedisHealthCheck();

      expect(redisService.healthCheck).toHaveBeenCalled();
      expect(result).toEqual({
        redis: {
          status: 'up',
          message: 'Redis connection is healthy',
        },
      });
    });

    it('should return down status when Redis is unhealthy', async () => {
      mockRedisService.healthCheck.mockResolvedValue(false);

      const result = await (controller as any).performRedisHealthCheck();

      expect(result).toEqual({
        redis: {
          status: 'down',
          message: 'Redis connection failed',
        },
      });
    });

    it('should handle Redis errors gracefully', async () => {
      const errorMessage = 'Connection timeout';
      mockRedisService.healthCheck.mockRejectedValue(new Error(errorMessage));

      const result = await (controller as any).performRedisHealthCheck();

      expect(result).toEqual({
        redis: {
          status: 'down',
          message: `Redis health check failed: ${errorMessage}`,
        },
      });
    });
  });

  describe('performCustomHealthCheck', () => {
    it('should pass when all critical services are healthy', async () => {
      const mockValidationResult = {
        status: 'ok',
        checks: {
          database: { status: 'pass', message: 'Database is healthy' },
          environment: { status: 'pass', message: 'Environment is valid' },
          redis: { status: 'fail', message: 'Redis is down' }, // Non-critical
        },
      };

      mockStartupValidationService.performHealthCheck.mockResolvedValue(
        mockValidationResult,
      );

      const result = await (controller as any).performCustomHealthCheck();

      expect(result).toEqual({
        'custom-validation': {
          status: 'up',
          checks: mockValidationResult.checks,
          overall_status: 'ok',
        },
      });
    });

    it('should throw error when critical services fail', async () => {
      const mockValidationResult = {
        status: 'error',
        checks: {
          database: { status: 'fail', message: 'Database connection failed' },
          environment: { status: 'pass', message: 'Environment is valid' },
        },
      };

      mockStartupValidationService.performHealthCheck.mockResolvedValue(
        mockValidationResult,
      );

      await expect(
        (controller as any).performCustomHealthCheck(),
      ).rejects.toThrow(
        'Critical health check failed: database: Database connection failed',
      );
    });

    it('should not fail for non-critical service failures', async () => {
      const mockValidationResult = {
        status: 'warning',
        checks: {
          database: { status: 'pass', message: 'Database is healthy' },
          environment: { status: 'pass', message: 'Environment is valid' },
          redis: { status: 'fail', message: 'Redis is down' },
          other: { status: 'fail', message: 'Some other service is down' },
        },
      };

      mockStartupValidationService.performHealthCheck.mockResolvedValue(
        mockValidationResult,
      );

      const result = await (controller as any).performCustomHealthCheck();

      expect(result).toEqual({
        'custom-validation': {
          status: 'up',
          checks: mockValidationResult.checks,
          overall_status: 'warning',
        },
      });
    });
  });
});
