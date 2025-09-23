import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockCacheManager: any;

  beforeEach(async () => {
    mockDataSource = {
      query: jest.fn(),
    } as any;

    mockCacheManager = {
      set: jest.fn(),
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkDatabase', () => {
    it('should return ok status when database is healthy', async () => {
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.checkDatabase();

      expect(result.status).toBe('ok');
      expect(result.message).toBe('Database connection is healthy');
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return error status when database is unhealthy', async () => {
      const error = new Error('Connection failed');
      mockDataSource.query.mockRejectedValue(error);

      const result = await service.checkDatabase();

      expect(result.status).toBe('error');
      expect(result.message).toBe('Database connection failed');
      expect(result.error).toBe('Connection failed');
    });
  });

  describe('checkRedis', () => {
    it('should return ok status when Redis is healthy', async () => {
      const testValue = '123456789';
      mockCacheManager.set.mockResolvedValue(undefined);
      mockCacheManager.get.mockResolvedValue(testValue);

      // Mock Date.now to return a consistent value
      const mockNow = jest.spyOn(Date, 'now').mockReturnValue(123456789);

      const result = await service.checkRedis();

      expect(result.status).toBe('ok');
      expect(result.message).toBe('Redis connection is healthy');
      expect(mockCacheManager.set).toHaveBeenCalledWith('health-check', testValue, 1000);
      expect(mockCacheManager.get).toHaveBeenCalledWith('health-check');

      mockNow.mockRestore();
    });

    it('should return error status when Redis read/write test fails', async () => {
      mockCacheManager.set.mockResolvedValue(undefined);
      mockCacheManager.get.mockResolvedValue('different-value');

      const result = await service.checkRedis();

      expect(result.status).toBe('error');
      expect(result.message).toBe('Redis read/write test failed');
    });

    it('should return error status when Redis connection fails', async () => {
      const error = new Error('Redis connection failed');
      mockCacheManager.set.mockRejectedValue(error);

      const result = await service.checkRedis();

      expect(result.status).toBe('error');
      expect(result.message).toBe('Redis connection failed');
      expect(result.error).toBe('Redis connection failed');
    });
  });

  describe('check', () => {
    it('should return ok status when all services are healthy', async () => {
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      mockCacheManager.set.mockResolvedValue(undefined);

      // Mock Date.now to return a consistent value
      const mockNow = jest.spyOn(Date, 'now').mockReturnValue(123456789);
      const testValue = '123456789';

      mockCacheManager.get.mockImplementation((key: string) => {
        if (key === 'health-check') return Promise.resolve(testValue);
        return Promise.resolve(null);
      });

      const result = await service.check();

      expect(result.status).toBe('ok');
      expect(result.checks.database.status).toBe('ok');
      expect(result.checks.redis.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeDefined();

      mockNow.mockRestore();
    });

    it('should return error status when any service is unhealthy', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB Error'));
      mockCacheManager.set.mockResolvedValue(undefined);

      // Mock Date.now to return a consistent value
      const mockNow = jest.spyOn(Date, 'now').mockReturnValue(123456789);
      const testValue = '123456789';

      mockCacheManager.get.mockResolvedValue(testValue);

      const result = await service.check();

      expect(result.status).toBe('error');
      expect(result.checks.database.status).toBe('error');
      expect(result.checks.redis.status).toBe('ok');

      mockNow.mockRestore();
    });
  });
});
