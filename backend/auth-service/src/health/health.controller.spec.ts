import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  HealthCheckService,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { DatabaseService } from '../database/database.service';
import { DatabaseOperationsService } from '../database/database-operations.service';
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';
import { RedisService } from '../common/redis/redis.service';

describe('HealthController', () => {
  let controller: HealthController;
  let redisService: RedisService;

  const mockHealthCheckService = {
    check: jest.fn(),
  };

  const mockHttpHealthIndicator = {};
  const mockMemoryHealthIndicator = {
    checkHeap: jest.fn(),
    checkRSS: jest.fn(),
  };
  const mockTypeOrmHealthIndicator = {
    pingCheck: jest.fn(),
  };

  const mockDatabaseService = {
    checkHealth: jest.fn(),
    checkMigrations: jest.fn(),
    getDatabaseInfo: jest.fn(),
  };

  const mockDatabaseOperationsService = {
    getDatabaseStatistics: jest.fn(),
    performMaintenanceTasks: jest.fn(),
  };

  const mockCircuitBreakerService = {
    getCircuitBreakerNames: jest.fn(),
    getAllCircuitBreakerStats: jest.fn(),
    getCircuitBreakerStats: jest.fn(),
  };

  const mockRedisService = {
    set: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    blacklistToken: jest.fn(),
    isTokenBlacklisted: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthCheckService,
        },
        {
          provide: HttpHealthIndicator,
          useValue: mockHttpHealthIndicator,
        },
        {
          provide: MemoryHealthIndicator,
          useValue: mockMemoryHealthIndicator,
        },
        {
          provide: TypeOrmHealthIndicator,
          useValue: mockTypeOrmHealthIndicator,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: DatabaseOperationsService,
          useValue: mockDatabaseOperationsService,
        },
        {
          provide: CircuitBreakerService,
          useValue: mockCircuitBreakerService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    redisService = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getReady', () => {
    it('should return readiness status', () => {
      const result = controller.getReady();
      
      expect(result).toHaveProperty('status', 'ready');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('getLive', () => {
    it('should return liveness status', () => {
      const result = controller.getLive();
      
      expect(result).toHaveProperty('status', 'alive');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('getRedisHealth', () => {
    it('should return healthy Redis status when connection works', async () => {
      mockRedisService.set.mockResolvedValue(undefined);
      mockRedisService.get.mockResolvedValue('health-test');
      mockRedisService.delete.mockResolvedValue(undefined);
      mockRedisService.blacklistToken.mockResolvedValue(undefined);
      mockRedisService.isTokenBlacklisted.mockResolvedValue(true);

      const result = await controller.getRedisHealth();

      expect(result).toHaveProperty('connected', true);
      expect(result).toHaveProperty('status', 'healthy');
      expect(result).toHaveProperty('responseTime');
      expect(result.features.basicOperations).toBe(true);
      expect(result.features.tokenBlacklist).toBe(true);
      expect(result.performance.connectionStatus).toBe('active');
    });

    it('should return unhealthy Redis status when connection fails', async () => {
      mockRedisService.set.mockRejectedValue(new Error('Connection failed'));

      const result = await controller.getRedisHealth();

      expect(result).toHaveProperty('connected', false);
      expect(result).toHaveProperty('status', 'unhealthy');
      expect(result).toHaveProperty('error', 'Connection failed');
      expect(result.features.basicOperations).toBe(false);
      expect(result.features.tokenBlacklist).toBe(false);
      expect(result.performance.connectionStatus).toBe('failed');
    });
  });

  describe('getDatabaseHealth', () => {
    it('should return database health information', async () => {
      const mockHealthCheck = { connected: true, responseTime: 50 };
      const mockMigrationStatus = { upToDate: true, executedMigrations: 5 };
      const mockDatabaseInfo = { type: 'PostgreSQL', version: '15.4' };

      mockDatabaseService.checkHealth.mockResolvedValue(mockHealthCheck);
      mockDatabaseService.checkMigrations.mockResolvedValue(mockMigrationStatus);
      mockDatabaseService.getDatabaseInfo.mockResolvedValue(mockDatabaseInfo);

      const result = await controller.getDatabaseHealth();

      expect(result).toHaveProperty('connected', true);
      expect(result).toHaveProperty('responseTime', 50);
      expect(result).toHaveProperty('migrations');
      expect(result).toHaveProperty('info');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('getCircuitBreakers', () => {
    it('should return circuit breaker statistics', () => {
      const mockNames = ['user-service', 'security-service'];
      const mockStats = {
        'user-service': { state: 'CLOSED', totalRequests: 100 },
        'security-service': { state: 'CLOSED', totalRequests: 50 },
      };

      mockCircuitBreakerService.getCircuitBreakerNames.mockReturnValue(mockNames);
      mockCircuitBreakerService.getAllCircuitBreakerStats.mockReturnValue(mockStats);

      const result = controller.getCircuitBreakers();

      expect(result).toHaveProperty('status', 'success');
      expect(result.circuitBreakers.count).toBe(2);
      expect(result.circuitBreakers.names).toEqual(mockNames);
      expect(result.circuitBreakers.statistics).toEqual(mockStats);
    });
  });
});