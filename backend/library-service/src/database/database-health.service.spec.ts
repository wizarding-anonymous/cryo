import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HealthCheckError } from '@nestjs/terminus';
import { DatabaseHealthService } from './database-health.service';

describe('DatabaseHealthService', () => {
  let service: DatabaseHealthService;
  let mockDataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    mockDataSource = {
      query: jest.fn(),
      options: {
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        database: 'library_service_test',
      },
    } as any;

    // Make isInitialized writable for tests
    Object.defineProperty(mockDataSource, 'isInitialized', {
      writable: true,
      value: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseHealthService,
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<DatabaseHealthService>(DatabaseHealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isHealthy', () => {
    it('should return healthy status when database is connected', async () => {
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.isHealthy('database');

      expect(result).toEqual({
        database: {
          status: 'up',
          isConnected: true,
          hasActiveConnections: true,
        },
      });
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should throw HealthCheckError when database is not initialized', async () => {
      Object.defineProperty(mockDataSource, 'isInitialized', {
        value: false,
        writable: true,
      });

      await expect(service.isHealthy('database')).rejects.toThrow(
        HealthCheckError,
      );
    });

    it('should throw HealthCheckError when query fails', async () => {
      mockDataSource.query.mockRejectedValue(new Error('Connection failed'));

      await expect(service.isHealthy('database')).rejects.toThrow(
        HealthCheckError,
      );
    });
  });

  describe('getConnectionInfo', () => {
    it('should return connection info when connected', async () => {
      const info = await service.getConnectionInfo();

      expect(info).toEqual({
        status: 'connected',
        database: 'library_service_test',
        host: 'localhost',
        port: 5432,
        type: 'postgres',
      });
    });

    it('should return disconnected status when not initialized', async () => {
      Object.defineProperty(mockDataSource, 'isInitialized', {
        value: false,
        writable: true,
      });

      const info = await service.getConnectionInfo();

      expect(info).toEqual({
        status: 'disconnected',
      });
    });
  });
});
