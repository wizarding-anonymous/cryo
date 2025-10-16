import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { SystemMetricsService } from './system-metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: jest.Mocked<MetricsService>;
  let systemMetricsService: jest.Mocked<SystemMetricsService>;

  beforeEach(async () => {
    const mockMetricsService = {
      getMetricsSummary: jest.fn(),
    };

    const mockSystemMetricsService = {
      getSystemMetricsSnapshot: jest.fn(),
      getMemoryUsageBreakdown: jest.fn(),
      getCpuUsage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
        {
          provide: SystemMetricsService,
          useValue: mockSystemMetricsService,
        },
      ],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    metricsService = module.get(MetricsService);
    systemMetricsService = module.get(SystemMetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMetricsSummary', () => {
    it('should return metrics summary', async () => {
      const mockSummary = {
        userOperations: 100,
        cacheHitRate: 0.85,
        batchOperations: 10,
        externalServiceCalls: 50,
        slowQueries: 3,
      };

      metricsService.getMetricsSummary.mockResolvedValue(mockSummary);

      const result = await controller.getMetricsSummary();

      expect(result).toEqual(mockSummary);
      expect(metricsService.getMetricsSummary).toHaveBeenCalled();
    });

    it('should handle errors from metrics service', async () => {
      metricsService.getMetricsSummary.mockRejectedValue(
        new Error('Metrics error'),
      );

      await expect(controller.getMetricsSummary()).rejects.toThrow(
        'Metrics error',
      );
    });
  });

  describe('getSystemMetrics', () => {
    it('should return system metrics snapshot', async () => {
      const mockSnapshot = {
        activeConnections: 10,
        memoryUsage: 1024000,
        databasePoolSize: 5,
        uptime: 3600,
        nodeVersion: 'v18.0.0',
        platform: 'linux',
      };

      systemMetricsService.getSystemMetricsSnapshot.mockResolvedValue(
        mockSnapshot,
      );

      const result = await controller.getSystemMetrics();

      expect(result).toEqual(mockSnapshot);
      expect(systemMetricsService.getSystemMetricsSnapshot).toHaveBeenCalled();
    });

    it('should handle errors from system metrics service', async () => {
      systemMetricsService.getSystemMetricsSnapshot.mockRejectedValue(
        new Error('System metrics error'),
      );

      await expect(controller.getSystemMetrics()).rejects.toThrow(
        'System metrics error',
      );
    });
  });

  describe('getMemoryUsage', () => {
    it('should return memory usage breakdown', () => {
      const mockMemoryUsage = {
        rss: 50000000,
        heapTotal: 30000000,
        heapUsed: 20000000,
        external: 5000000,
        arrayBuffers: 1000000,
      };

      systemMetricsService.getMemoryUsageBreakdown.mockReturnValue(
        mockMemoryUsage,
      );

      const result = controller.getMemoryUsage();

      expect(result).toEqual(mockMemoryUsage);
      expect(systemMetricsService.getMemoryUsageBreakdown).toHaveBeenCalled();
    });

    it('should handle errors from memory usage breakdown', () => {
      systemMetricsService.getMemoryUsageBreakdown.mockImplementation(() => {
        throw new Error('Memory usage error');
      });

      expect(() => controller.getMemoryUsage()).toThrow('Memory usage error');
    });
  });

  describe('getCpuUsage', () => {
    it('should return CPU usage', () => {
      const mockCpuUsage = {
        user: 1000000,
        system: 500000,
      };

      systemMetricsService.getCpuUsage.mockReturnValue(mockCpuUsage);

      const result = controller.getCpuUsage();

      expect(result).toEqual(mockCpuUsage);
      expect(systemMetricsService.getCpuUsage).toHaveBeenCalled();
    });

    it('should handle errors from CPU usage', () => {
      systemMetricsService.getCpuUsage.mockImplementation(() => {
        throw new Error('CPU usage error');
      });

      expect(() => controller.getCpuUsage()).toThrow('CPU usage error');
    });
  });

  describe('getHealthCheck', () => {
    it('should return health check with all metrics', async () => {
      const mockSummary = {
        userOperations: 100,
        cacheHitRate: 0.85,
        batchOperations: 10,
        externalServiceCalls: 50,
        slowQueries: 3,
      };

      const mockSnapshot = {
        activeConnections: 10,
        memoryUsage: 1024000,
        databasePoolSize: 5,
        uptime: 3600,
        nodeVersion: 'v18.0.0',
        platform: 'linux',
      };

      const mockMemoryUsage = {
        rss: 50000000,
        heapTotal: 30000000,
        heapUsed: 20000000,
        external: 5000000,
        arrayBuffers: 1000000,
      };

      const mockCpuUsage = {
        user: 1000000,
        system: 500000,
      };

      metricsService.getMetricsSummary.mockResolvedValue(mockSummary);
      systemMetricsService.getSystemMetricsSnapshot.mockResolvedValue(
        mockSnapshot,
      );
      systemMetricsService.getMemoryUsageBreakdown.mockReturnValue(
        mockMemoryUsage,
      );
      systemMetricsService.getCpuUsage.mockReturnValue(mockCpuUsage);

      const result = await controller.getHealthCheck();

      expect(result).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        metrics: mockSummary,
        system: mockSnapshot,
        memory: mockMemoryUsage,
        cpu: mockCpuUsage,
      });
    });

    it('should return unhealthy status when metrics fail', async () => {
      metricsService.getMetricsSummary.mockRejectedValue(
        new Error('Metrics error'),
      );

      const result = await controller.getHealthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Metrics error');
    });

    it('should return unhealthy status when system metrics fail', async () => {
      const mockSummary = {
        userOperations: 100,
        cacheHitRate: 0.85,
        batchOperations: 10,
        externalServiceCalls: 50,
        slowQueries: 3,
      };

      metricsService.getMetricsSummary.mockResolvedValue(mockSummary);
      systemMetricsService.getSystemMetricsSnapshot.mockRejectedValue(
        new Error('System error'),
      );

      const result = await controller.getHealthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('System error');
    });
  });
});
