import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { StartupValidationService } from '../config/startup-validation.service';
import { AppConfigService } from '../config/config.service';
import { RedisService } from '../common/redis/redis.service';
import { CacheService } from '../common/cache/cache.service';
import { AuthServiceClient } from '../integrations/auth/auth-service.client';
import { SecurityClient } from '../integrations/security/security.client';
import { MetricsService } from '../common/metrics/metrics.service';
import { SystemMetricsService } from '../common/metrics/system-metrics.service';

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

const mockDiskHealthIndicator = {
  checkStorage: jest.fn(),
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

const mockAuthServiceClient = {
  healthCheck: jest.fn(),
};

const mockSecurityClient = {
  healthCheck: jest.fn(),
};

const mockCacheService = {
  healthCheck: jest.fn(),
  getCacheStats: jest.fn(),
  getCacheInfo: jest.fn(),
};

const mockMetricsService = {
  getMetricsSummary: jest.fn(),
};

const mockSystemMetricsService = {
  getSystemMetricsSnapshot: jest.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;
  let startupValidationService: StartupValidationService;
  let redisService: RedisService;
  let authServiceClient: AuthServiceClient;
  let securityClient: SecurityClient;
  let cacheService: CacheService;
  let metricsService: MetricsService;
  let systemMetricsService: SystemMetricsService;

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
        { provide: DiskHealthIndicator, useValue: mockDiskHealthIndicator },
        {
          provide: StartupValidationService,
          useValue: mockStartupValidationService,
        },
        { provide: AppConfigService, useValue: mockAppConfigService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: AuthServiceClient, useValue: mockAuthServiceClient },
        { provide: SecurityClient, useValue: mockSecurityClient },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: SystemMetricsService, useValue: mockSystemMetricsService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
    startupValidationService = module.get<StartupValidationService>(
      StartupValidationService,
    );
    redisService = module.get<RedisService>(RedisService);
    authServiceClient = module.get<AuthServiceClient>(AuthServiceClient);
    securityClient = module.get<SecurityClient>(SecurityClient);
    cacheService = module.get<CacheService>(CacheService);
    metricsService = module.get<MetricsService>(MetricsService);
    systemMetricsService = module.get<SystemMetricsService>(SystemMetricsService);
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
        expect.any(Function), // database
        expect.any(Function), // memory heap
        expect.any(Function), // memory rss
        expect.any(Function), // disk storage
        expect.any(Function), // redis
        expect.any(Function), // cache
        expect.any(Function), // auth service
        expect.any(Function), // security service
        expect.any(Function), // custom validation
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

      const mockCacheStats = {
        hitRatio: 85.5,
        totalOperations: 1000,
        averageLatency: 2.5,
      };

      const mockCacheInfo = {
        type: 'redis',
        connected: true,
      };

      mockStartupValidationService.performHealthCheck.mockResolvedValue(
        mockValidationResult,
      );
      mockCacheService.getCacheStats.mockResolvedValue(mockCacheStats);
      mockCacheService.getCacheInfo.mockResolvedValue(mockCacheInfo);

      const result = await controller.detailedCheck();

      expect(startupValidationService.performHealthCheck).toHaveBeenCalled();
      expect(cacheService.getCacheStats).toHaveBeenCalled();
      expect(cacheService.getCacheInfo).toHaveBeenCalled();
      expect(result).toMatchObject({
        service: 'user-service',
        version: '1.0.0',
        environment: 'test',
        status: 'ok',
        checks: mockValidationResult.checks,
        cache: {
          stats: mockCacheStats,
          info: mockCacheInfo,
        },
      });
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('getHealthMetrics', () => {
    it('should return comprehensive health metrics', async () => {
      const mockMetricsSummary = {
        userOperations: 500,
        cacheHitRate: 85.5,
        batchOperations: 25,
        externalServiceCalls: 100,
        slowQueries: 2,
      };

      const mockSystemSnapshot = {
        activeConnections: 10,
        databasePoolSize: 5,
        memoryUsage: 150 * 1024 * 1024,
        uptime: 3600,
        nodeVersion: 'v18.0.0',
        platform: 'linux',
      };

      const mockCacheStats = {
        hitRatio: 85.5,
        totalOperations: 1000,
        averageLatency: 2.5,
      };

      mockMetricsService.getMetricsSummary.mockResolvedValue(mockMetricsSummary);
      mockSystemMetricsService.getSystemMetricsSnapshot.mockResolvedValue(mockSystemSnapshot);
      mockCacheService.getCacheStats.mockResolvedValue(mockCacheStats);
      mockRedisService.healthCheck.mockResolvedValue(true);
      mockTypeOrmHealthIndicator.pingCheck.mockResolvedValue({ database: { status: 'up' } });
      mockCacheService.healthCheck.mockResolvedValue(true);
      mockAuthServiceClient.healthCheck.mockResolvedValue(true);
      mockSecurityClient.healthCheck.mockResolvedValue({ status: 'healthy', latency: 50 });

      const result = await controller.getHealthMetrics();

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('service');
      expect(result).toHaveProperty('health');
      expect(result).toHaveProperty('metrics');
      expect(result.health).toHaveProperty('overall');
      expect(result.health).toHaveProperty('totalLatency');
      expect(result.health).toHaveProperty('components');
      expect(result.metrics).toHaveProperty('service');
      expect(result.metrics.service).toHaveProperty('healthScore');
    });

    it('should handle service failures gracefully in metrics', async () => {
      mockMetricsService.getMetricsSummary.mockRejectedValue(new Error('Metrics service error'));
      mockSystemMetricsService.getSystemMetricsSnapshot.mockRejectedValue(new Error('System metrics error'));
      mockRedisService.healthCheck.mockRejectedValue(new Error('Redis error'));
      mockTypeOrmHealthIndicator.pingCheck.mockRejectedValue(new Error('Database error'));

      const result = await controller.getHealthMetrics();

      expect(result).toHaveProperty('health');
      expect(result.health.overall).toBe('degraded');
      expect(result.health.components.database.status).toBe('unhealthy');
      expect(result.health.components.redis.status).toBe('unhealthy');
    });
  });

  describe('readinessCheck', () => {
    it('should perform readiness checks for Kubernetes', async () => {
      const mockHealthResult = {
        status: 'ok',
        info: { database: { status: 'up' } },
        error: {},
        details: { database: { status: 'up' } },
      };

      mockHealthCheckService.check.mockResolvedValue(mockHealthResult);
      mockRedisService.healthCheck.mockResolvedValue(true);
      mockAuthServiceClient.healthCheck.mockResolvedValue(true);
      mockSecurityClient.healthCheck.mockResolvedValue({ status: 'healthy' });

      const result = await controller.readinessCheck();

      expect(healthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function), // database
        expect.any(Function), // redis
        expect.any(Function), // external services
      ]);
      expect(result).toEqual(mockHealthResult);
    });
  });

  describe('livenessCheck', () => {
    it('should perform liveness checks for Kubernetes', async () => {
      const mockHealthResult = {
        status: 'ok',
        info: { memory_heap: { status: 'up' } },
        error: {},
        details: { memory_heap: { status: 'up' } },
      };

      mockHealthCheckService.check.mockResolvedValue(mockHealthResult);

      const result = await controller.livenessCheck();

      expect(healthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function), // memory heap
        expect.any(Function), // memory rss
        expect.any(Function), // disk storage
      ]);
      expect(result).toEqual(mockHealthResult);
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

  describe('calculateHealthScore', () => {
    it('should return 100 when all services are healthy', async () => {
      // Mock low memory usage
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 50 * 1024 * 1024, // 50MB - low usage
        heapTotal: 100 * 1024 * 1024,
        rss: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      });

      mockTypeOrmHealthIndicator.pingCheck.mockResolvedValue({ database: { status: 'up' } });
      mockRedisService.healthCheck.mockResolvedValue(true);
      mockAuthServiceClient.healthCheck.mockResolvedValue(true);
      mockSecurityClient.healthCheck.mockResolvedValue({ status: 'healthy' });

      const result = await (controller as any).calculateHealthScore();

      expect(result).toBe(100);

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });

    it('should deduct points for database failure', async () => {
      // Mock low memory usage
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 50 * 1024 * 1024, // 50MB - low usage
        heapTotal: 100 * 1024 * 1024,
        rss: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      });

      mockTypeOrmHealthIndicator.pingCheck.mockRejectedValue(new Error('Database error'));
      mockRedisService.healthCheck.mockResolvedValue(true);
      mockAuthServiceClient.healthCheck.mockResolvedValue(true);
      mockSecurityClient.healthCheck.mockResolvedValue({ status: 'healthy' });

      const result = await (controller as any).calculateHealthScore();

      expect(result).toBe(60); // 100 - 40 for database

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });

    it('should deduct points for Redis failure', async () => {
      // Mock low memory usage
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 50 * 1024 * 1024, // 50MB - low usage
        heapTotal: 100 * 1024 * 1024,
        rss: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      });

      mockTypeOrmHealthIndicator.pingCheck.mockResolvedValue({ database: { status: 'up' } });
      mockRedisService.healthCheck.mockResolvedValue(false);
      mockAuthServiceClient.healthCheck.mockResolvedValue(true);
      mockSecurityClient.healthCheck.mockResolvedValue({ status: 'healthy' });

      const result = await (controller as any).calculateHealthScore();

      expect(result).toBe(80); // 100 - 20 for Redis

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });

    it('should deduct points for external service failures', async () => {
      // Mock low memory usage
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 50 * 1024 * 1024, // 50MB - low usage
        heapTotal: 100 * 1024 * 1024,
        rss: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      });

      mockTypeOrmHealthIndicator.pingCheck.mockResolvedValue({ database: { status: 'up' } });
      mockRedisService.healthCheck.mockResolvedValue(true);
      mockAuthServiceClient.healthCheck.mockResolvedValue(false);
      mockSecurityClient.healthCheck.mockResolvedValue({ status: 'unhealthy' });

      const result = await (controller as any).calculateHealthScore();

      expect(result).toBe(80); // 100 - 10 for auth - 10 for security

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });

    it('should return 0 on calculation error', async () => {
      mockTypeOrmHealthIndicator.pingCheck.mockRejectedValue(new Error('Unexpected error'));
      // Mock process.memoryUsage to throw an error
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockImplementation(() => {
        throw new Error('Memory error');
      });

      const result = await (controller as any).calculateHealthScore();

      expect(result).toBe(0);

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('measureEventLoopLag', () => {
    it('should measure event loop lag', async () => {
      const result = await (controller as any).measureEventLoopLag();

      expect(result).toMatch(/^\d+\.\d{2}ms$/);
    });
  });

  describe('getOperationMetrics', () => {
    it('should return operation metrics when MetricsService is available', async () => {
      const mockSummary = {
        userOperations: 500,
        cacheHitRate: 85.5,
        batchOperations: 25,
        externalServiceCalls: 100,
        slowQueries: 2,
      };

      mockMetricsService.getMetricsSummary.mockResolvedValue(mockSummary);

      const result = await (controller as any).getOperationMetrics();

      expect(result).toEqual({
        userOperations: 500,
        batchOperations: 25,
        externalServiceCalls: 100,
        slowQueries: 2,
        cacheHitRate: '85.50%',
      });
    });

    it('should handle MetricsService errors', async () => {
      mockMetricsService.getMetricsSummary.mockRejectedValue(new Error('Metrics error'));

      const result = await (controller as any).getOperationMetrics();

      expect(result).toEqual({
        status: 'error',
        error: 'Metrics error',
      });
    });
  });

  describe('getResourceMetrics', () => {
    it('should return resource metrics when SystemMetricsService is available', async () => {
      const mockSnapshot = {
        activeConnections: 10,
        databasePoolSize: 5,
        memoryUsage: 150 * 1024 * 1024,
        uptime: 3600,
        nodeVersion: 'v18.0.0',
        platform: 'linux',
      };

      mockSystemMetricsService.getSystemMetricsSnapshot.mockResolvedValue(mockSnapshot);

      const result = await (controller as any).getResourceMetrics();

      expect(result).toEqual({
        activeConnections: 10,
        databasePoolSize: 5,
        memoryUsage: '150MB',
        platform: 'linux',
        nodeVersion: 'v18.0.0',
      });
    });

    it('should handle SystemMetricsService errors', async () => {
      mockSystemMetricsService.getSystemMetricsSnapshot.mockRejectedValue(new Error('System error'));

      const result = await (controller as any).getResourceMetrics();

      expect(result).toEqual({
        status: 'error',
        error: 'System error',
      });
    });
  });
});
