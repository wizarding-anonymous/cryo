import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { HealthController } from './health.controller';
import { ExternalServicesHealthService } from '../clients/external-services-health.service';
import { CircuitBreakerService } from '../clients/circuit-breaker.service';

const mockExternalServicesHealthService = {
  getHealthStatus: jest.fn(),
  areAllServicesHealthy: jest.fn(),
};

const mockCircuitBreakerService = {
  getAllStats: jest.fn(),
};

const mockResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

describe('HealthController', () => {
  let controller: HealthController;
  let externalServicesHealthService: ExternalServicesHealthService;
  let circuitBreakerService: CircuitBreakerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ExternalServicesHealthService,
          useValue: mockExternalServicesHealthService,
        },
        {
          provide: CircuitBreakerService,
          useValue: mockCircuitBreakerService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    externalServicesHealthService = module.get<ExternalServicesHealthService>(
      ExternalServicesHealthService,
    );
    circuitBreakerService = module.get<CircuitBreakerService>(CircuitBreakerService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return basic health status', () => {
      const res = mockResponse();

      controller.check(res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          version: expect.any(String),
          environment: expect.any(String),
          memory: expect.objectContaining({
            used: expect.any(Number),
            total: expect.any(Number),
            percentage: expect.any(Number),
          }),
        }),
      );
    });

    it('should handle errors gracefully', () => {
      const res = mockResponse();
      // Mock process.memoryUsage to throw an error
      const originalMemoryUsage = process.memoryUsage;
      const mockMemoryUsage = jest.fn().mockImplementation(() => {
        throw new Error('Memory usage error');
      }) as any;
      mockMemoryUsage.rss = jest.fn();
      process.memoryUsage = mockMemoryUsage;

      controller.check(res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          timestamp: expect.any(String),
          error: 'Memory usage error',
        }),
      );

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('checkDetailed', () => {
    it('should return detailed health status when all services are healthy', async () => {
      const res = mockResponse();
      const healthStatus = {
        userService: { status: 'up', lastCheck: new Date() },
        notificationService: { status: 'up', lastCheck: new Date() },
        achievementService: { status: 'up', lastCheck: new Date() },
      };
      const circuitStats = {
        'user-service': { state: 'CLOSED', failureCount: 0 },
      };

      mockExternalServicesHealthService.getHealthStatus.mockReturnValue(healthStatus);
      mockExternalServicesHealthService.areAllServicesHealthy.mockReturnValue(true);
      mockCircuitBreakerService.getAllStats.mockReturnValue(circuitStats);

      await controller.checkDetailed(res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          timestamp: expect.any(String),
          services: healthStatus,
          circuits: circuitStats,
        }),
      );
    });

    it('should return degraded status when some services are unhealthy', async () => {
      const res = mockResponse();
      const healthStatus = {
        userService: { status: 'up', lastCheck: new Date() },
        notificationService: { status: 'down', lastCheck: new Date(), error: 'Connection failed' },
      };

      mockExternalServicesHealthService.getHealthStatus.mockReturnValue(healthStatus);
      mockExternalServicesHealthService.areAllServicesHealthy.mockReturnValue(false);
      mockCircuitBreakerService.getAllStats.mockReturnValue({});

      await controller.checkDetailed(res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded',
          services: healthStatus,
        }),
      );
    });
  });

  describe('checkExternal', () => {
    it('should return healthy status when all services are healthy', () => {
      const healthStatus = {
        userService: { status: 'up', lastCheck: new Date() },
        notificationService: { status: 'up', lastCheck: new Date() },
        achievementService: { status: 'up', lastCheck: new Date() },
      };

      mockExternalServicesHealthService.getHealthStatus.mockReturnValue(healthStatus);
      mockExternalServicesHealthService.areAllServicesHealthy.mockReturnValue(true);

      const result = controller.checkExternal();

      expect(result.status).toBe('healthy');
      expect(result.services).toEqual(healthStatus);
      expect(result).toHaveProperty('timestamp');
    });

    it('should return degraded status when some services are unhealthy', () => {
      const healthStatus = {
        userService: { status: 'up', lastCheck: new Date() },
        notificationService: { status: 'down', lastCheck: new Date(), error: 'Connection failed' },
        achievementService: { status: 'up', lastCheck: new Date() },
      };

      mockExternalServicesHealthService.getHealthStatus.mockReturnValue(healthStatus);
      mockExternalServicesHealthService.areAllServicesHealthy.mockReturnValue(false);

      const result = controller.checkExternal();

      expect(result.status).toBe('degraded');
      expect(result.services).toEqual(healthStatus);
    });
  });

  describe('checkCircuits', () => {
    it('should return circuit breaker statistics', () => {
      const circuitStats = {
        'user-service': {
          state: 'CLOSED',
          failureCount: 0,
          successCount: 10,
          lastFailureTime: null,
        },
        'notification-service': {
          state: 'OPEN',
          failureCount: 5,
          successCount: 2,
          lastFailureTime: new Date(),
        },
      };

      mockCircuitBreakerService.getAllStats.mockReturnValue(circuitStats);

      const result = controller.checkCircuits();

      expect(result.circuits).toEqual(circuitStats);
      expect(result).toHaveProperty('timestamp');
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('readiness', () => {
    it('should return ready status when all services are healthy', async () => {
      const res = mockResponse();
      mockExternalServicesHealthService.areAllServicesHealthy.mockReturnValue(true);

      await controller.readiness(res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready',
          timestamp: expect.any(String),
        }),
      );
    });

    it('should return not ready status when services are unhealthy', async () => {
      const res = mockResponse();
      mockExternalServicesHealthService.areAllServicesHealthy.mockReturnValue(false);

      await controller.readiness(res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'not ready',
          reason: 'External dependencies not available',
        }),
      );
    });
  });

  describe('live', () => {
    it('should return alive status', () => {
      const res = mockResponse();

      controller.live(res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'alive',
          timestamp: expect.any(String),
          uptime: expect.any(Number),
        }),
      );
    });
  });
});
