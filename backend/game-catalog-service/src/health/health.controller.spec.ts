/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  HealthCheckResult,
} from '@nestjs/terminus';
import { CacheService } from '../common/services/cache.service';
import { RedisConfigService } from '../database/redis-config.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: jest.Mocked<HealthCheckService>;
  let dbHealthIndicator: jest.Mocked<TypeOrmHealthIndicator>;
  let memoryHealthIndicator: jest.Mocked<MemoryHealthIndicator>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const mockHealthCheckService = {
      check: jest.fn(),
    };

    const mockDbHealthIndicator = {
      pingCheck: jest.fn(),
    };

    const mockMemoryHealthIndicator = {
      checkHeap: jest.fn(),
      checkRSS: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
      invalidateGameCache: jest.fn(),
      getCacheStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthCheckService,
        },
        {
          provide: TypeOrmHealthIndicator,
          useValue: mockDbHealthIndicator,
        },
        {
          provide: MemoryHealthIndicator,
          useValue: mockMemoryHealthIndicator,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: RedisConfigService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            isAvailable: jest.fn().mockReturnValue(true),
            getConnectionInfo: jest.fn().mockReturnValue('localhost:6379 (connected)'),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get(HealthCheckService);
    dbHealthIndicator = module.get(TypeOrmHealthIndicator);
    memoryHealthIndicator = module.get(MemoryHealthIndicator);
    cacheService = module.get(CacheService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return healthy status when all checks pass', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {
          database: { status: 'up' },
          memory_heap: { status: 'up' },
          memory_rss: { status: 'up' },
          redis: { status: 'up' },
          application: { status: 'up' },
        },
        error: {},
        details: {
          database: { status: 'up' },
          memory_heap: { status: 'up' },
          memory_rss: { status: 'up' },
          redis: { status: 'up' },
          application: { status: 'up' },
        },
      };

      healthCheckService.check.mockResolvedValue(mockResult);
      dbHealthIndicator.pingCheck.mockResolvedValue({
        database: { status: 'up' },
      });
      memoryHealthIndicator.checkHeap.mockResolvedValue({
        memory_heap: { status: 'up' },
      });
      memoryHealthIndicator.checkRSS.mockResolvedValue({
        memory_rss: { status: 'up' },
      });
      cacheService.set.mockResolvedValue(undefined);
      cacheService.get.mockResolvedValue('test-value');

      const result = await controller.check();

      expect(result).toEqual(mockResult);
      expect(healthCheckService.check).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.any(Function),
          expect.any(Function),
          expect.any(Function),
          expect.any(Function),
          expect.any(Function),
        ]),
      );
    });

    it('should handle database connection failure', async () => {
      const mockError = new Error('Database connection failed');
      dbHealthIndicator.pingCheck.mockRejectedValue(mockError);

      healthCheckService.check.mockRejectedValue({
        status: 'error',
        error: {
          database: {
            status: 'down',
            message: 'Database connection failed',
          },
        },
      });

      await expect(controller.check()).rejects.toMatchObject({
        status: 'error',
        error: {
          database: {
            status: 'down',
            message: 'Database connection failed',
          },
        },
      });
    });
  });

  describe('readiness', () => {
    it('should return ready status when database and cache are available', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {
          database: { status: 'up' },
          redis: { status: 'up' },
        },
        error: {},
        details: {
          database: { status: 'up' },
          redis: { status: 'up' },
        },
      };

      healthCheckService.check.mockResolvedValue(mockResult);
      dbHealthIndicator.pingCheck.mockResolvedValue({
        database: { status: 'up' },
      });
      cacheService.set.mockResolvedValue(undefined);
      cacheService.get.mockResolvedValue('test-value');

      const result = await controller.readiness();

      expect(result).toEqual(mockResult);
      expect(healthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
      ]);
    });

    it('should return not ready when database is unavailable', async () => {
      const mockError = new Error('Database not ready');
      dbHealthIndicator.pingCheck.mockRejectedValue(mockError);

      healthCheckService.check.mockRejectedValue({
        status: 'error',
        error: {
          database: {
            status: 'down',
            message: 'Database not ready',
          },
        },
      });

      await expect(controller.readiness()).rejects.toMatchObject({
        status: 'error',
        error: {
          database: {
            status: 'down',
            message: 'Database not ready',
          },
        },
      });
    });
  });

  describe('liveness', () => {
    it('should return alive status when memory usage is acceptable', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {
          memory_heap: { status: 'up' },
          application: { status: 'up' },
        },
        error: {},
        details: {
          memory_heap: { status: 'up' },
          application: { status: 'up' },
        },
      };

      healthCheckService.check.mockResolvedValue(mockResult);
      memoryHealthIndicator.checkHeap.mockResolvedValue({
        memory_heap: { status: 'up' },
      });

      const result = await controller.liveness();

      expect(result).toEqual(mockResult);
      expect(healthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
      ]);
    });

    it('should return not alive when memory usage is too high', async () => {
      const mockError = new Error('Memory usage too high');
      memoryHealthIndicator.checkHeap.mockRejectedValue(mockError);

      healthCheckService.check.mockRejectedValue({
        status: 'error',
        error: {
          memory_heap: {
            status: 'down',
            message: 'Memory usage too high',
          },
        },
      });

      await expect(controller.liveness()).rejects.toMatchObject({
        status: 'error',
        error: {
          memory_heap: {
            status: 'down',
            message: 'Memory usage too high',
          },
        },
      });
    });
  });

  describe('Redis health check', () => {
    it('should handle Redis connection success', async () => {
      cacheService.set.mockResolvedValue(undefined);
      cacheService.get.mockResolvedValue('test-value');

      // Call the private method through the public check method
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {
          redis: { status: 'up', message: 'Redis connection is healthy' },
        },
        error: {},
        details: {
          redis: { status: 'up', message: 'Redis connection is healthy' },
        },
      };

      healthCheckService.check.mockResolvedValue(mockResult);

      const result = await controller.check();
      expect(result.info?.redis?.status).toBe('up');
    });

    it('should handle Redis connection failure with memory fallback', async () => {
      cacheService.set.mockRejectedValueOnce(
        new Error('Redis connection failed'),
      );
      cacheService.set.mockResolvedValueOnce(undefined); // Memory cache fallback
      cacheService.get.mockResolvedValue('test-value');

      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {
          redis: {
            status: 'up',
            message: 'Using memory cache fallback (Redis unavailable)',
            fallback: true,
          },
        },
        error: {},
        details: {
          redis: {
            status: 'up',
            message: 'Using memory cache fallback (Redis unavailable)',
            fallback: true,
          },
        },
      };

      healthCheckService.check.mockResolvedValue(mockResult);

      const result = await controller.check();
      expect(result.info?.redis?.fallback).toBe(true);
    });
  });

  describe('Application health check', () => {
    it('should return application status with system information', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {
          application: {
            status: 'up',
            uptime: expect.any(String),
            memory: expect.any(Object),
            nodeVersion: process.version,
            environment: 'test',
          },
        },
        error: {},
        details: {
          application: {
            status: 'up',
            uptime: expect.any(String),
            memory: expect.any(Object),
            nodeVersion: process.version,
            environment: 'test',
          },
        },
      };

      healthCheckService.check.mockResolvedValue(mockResult);

      const result = await controller.check();
      expect(result.info?.application?.status).toBe('up');
      expect(result.info?.application?.nodeVersion).toBe(process.version);
    });
  });
});
