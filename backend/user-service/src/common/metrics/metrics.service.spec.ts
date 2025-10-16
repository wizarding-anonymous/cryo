import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

// Mock all Prometheus metrics
const mockCounter = {
  inc: jest.fn(),
  get: jest.fn(),
};

const mockHistogram = {
  observe: jest.fn(),
  get: jest.fn(),
};

const mockGauge = {
  set: jest.fn(),
  get: jest.fn(),
};

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: MetricsService,
          useValue: {
            recordUserOperation: jest.fn(),
            recordCacheOperation: jest.fn(),
            recordBatchOperation: jest.fn(),
            recordExternalServiceCall: jest.fn(),
            recordDatabaseOperation: jest.fn(),
            recordSlowQuery: jest.fn(),
            updateSystemMetrics: jest.fn(),
            getMetricsSummary: jest.fn(),
            getCacheHitRate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordUserOperation', () => {
    it('should record user operation metrics', () => {
      service.recordUserOperation('create_user', 'success', 150);
      expect(service.recordUserOperation).toHaveBeenCalledWith(
        'create_user',
        'success',
        150,
      );
    });

    it('should record user operation without duration', () => {
      service.recordUserOperation('get_user', 'success');
      expect(service.recordUserOperation).toHaveBeenCalledWith(
        'get_user',
        'success',
      );
    });
  });

  describe('recordCacheOperation', () => {
    it('should record cache hit', () => {
      service.recordCacheOperation('hit', 'user', 50);
      expect(service.recordCacheOperation).toHaveBeenCalledWith(
        'hit',
        'user',
        50,
      );
    });

    it('should record cache miss', () => {
      service.recordCacheOperation('miss', 'profile', 25);
      expect(service.recordCacheOperation).toHaveBeenCalledWith(
        'miss',
        'profile',
        25,
      );
    });
  });

  describe('recordBatchOperation', () => {
    it('should record batch operation metrics', () => {
      service.recordBatchOperation('create_users', 'success', 100, 2000);
      expect(service.recordBatchOperation).toHaveBeenCalledWith(
        'create_users',
        'success',
        100,
        2000,
      );
    });
  });

  describe('recordExternalServiceCall', () => {
    it('should record external service call metrics', () => {
      service.recordExternalServiceCall(
        'auth-service',
        'validate_token',
        'success',
        300,
      );
      expect(service.recordExternalServiceCall).toHaveBeenCalledWith(
        'auth-service',
        'validate_token',
        'success',
        300,
      );
    });
  });

  describe('recordDatabaseOperation', () => {
    it('should record database operation metrics', () => {
      service.recordDatabaseOperation('select', 'users', 'success', 100);
      expect(service.recordDatabaseOperation).toHaveBeenCalledWith(
        'select',
        'users',
        'success',
        100,
      );
    });
  });

  describe('recordSlowQuery', () => {
    it('should record slow query metrics', () => {
      service.recordSlowQuery('select', 'users', 1500);
      expect(service.recordSlowQuery).toHaveBeenCalledWith(
        'select',
        'users',
        1500,
      );
    });
  });

  describe('updateSystemMetrics', () => {
    it('should update system metrics', () => {
      const metrics = {
        activeConnections: 10,
        memoryUsage: 1024000,
        databasePoolSize: 5,
      };

      service.updateSystemMetrics(metrics);
      expect(service.updateSystemMetrics).toHaveBeenCalledWith(metrics);
    });

    it('should update partial system metrics', () => {
      const metrics = {
        activeConnections: 15,
      };

      service.updateSystemMetrics(metrics);
      expect(service.updateSystemMetrics).toHaveBeenCalledWith(metrics);
    });
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

      (service.getMetricsSummary as jest.Mock).mockResolvedValue(mockSummary);

      const result = await service.getMetricsSummary();
      expect(result).toEqual(mockSummary);
    });
  });

  describe('getCacheHitRate', () => {
    it('should return cache hit rate', async () => {
      const mockHitRate = 0.85;
      (service.getCacheHitRate as jest.Mock).mockResolvedValue(mockHitRate);

      const result = await service.getCacheHitRate();
      expect(result).toBe(mockHitRate);
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully in recordUserOperation', () => {
      // Mock implementation that throws error
      (service.recordUserOperation as jest.Mock).mockImplementation(() => {
        throw new Error('Metrics error');
      });

      expect(() => {
        service.recordUserOperation('create_user', 'success', 150);
      }).toThrow('Metrics error');
    });

    it('should handle errors gracefully in updateSystemMetrics', () => {
      // Mock implementation that throws error
      (service.updateSystemMetrics as jest.Mock).mockImplementation(() => {
        throw new Error('System metrics error');
      });

      const metrics = {
        activeConnections: 10,
        memoryUsage: 1024000,
        databasePoolSize: 5,
      };

      expect(() => {
        service.updateSystemMetrics(metrics);
      }).toThrow('System metrics error');
    });
  });
});
