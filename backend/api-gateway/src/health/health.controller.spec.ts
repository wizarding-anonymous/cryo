import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HealthCheckResultDto, ServiceHealthStatusDto } from './dto/health.dto';

describe('HealthController', () => {
  let controller: HealthController;
  let mockHealthService: jest.Mocked<HealthService>;

  beforeEach(async () => {
    mockHealthService = {
      checkGateway: jest.fn(),
      checkServices: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkHealth', () => {
    it('should return gateway health status', async () => {
      const mockHealthResult: HealthCheckResultDto = {
        status: 'ok',
        timestamp: '2024-01-15T10:30:00.000Z',
        uptime: 3600,
      };

      mockHealthService.checkGateway.mockResolvedValue(mockHealthResult);

      const result = await controller.checkHealth();

      expect(result).toEqual(mockHealthResult);
      expect(mockHealthService.checkGateway).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors gracefully', async () => {
      const error = new Error('Service unavailable');
      mockHealthService.checkGateway.mockRejectedValue(error);

      await expect(controller.checkHealth()).rejects.toThrow('Service unavailable');
      expect(mockHealthService.checkGateway).toHaveBeenCalledTimes(1);
    });

    it('should return error status when gateway is unhealthy', async () => {
      const mockHealthResult: HealthCheckResultDto = {
        status: 'error',
        timestamp: '2024-01-15T10:30:00.000Z',
        uptime: 3600,
      };

      mockHealthService.checkGateway.mockResolvedValue(mockHealthResult);

      const result = await controller.checkHealth();

      expect(result).toEqual(mockHealthResult);
      expect(result.status).toBe('error');
    });
  });

  describe('checkServicesHealth', () => {
    it('should return empty array when no services are registered', async () => {
      mockHealthService.checkServices.mockResolvedValue([]);

      const result = await controller.checkServicesHealth();

      expect(result).toEqual([]);
      expect(mockHealthService.checkServices).toHaveBeenCalledTimes(1);
    });

    it('should return health status of all services', async () => {
      const mockServicesHealth: ServiceHealthStatusDto[] = [
        {
          name: 'user-service',
          status: 'healthy',
          responseTime: 150,
          lastCheck: '2024-01-15T10:30:00.000Z',
        },
        {
          name: 'game-service',
          status: 'healthy',
          responseTime: 200,
          lastCheck: '2024-01-15T10:30:01.000Z',
        },
      ];

      mockHealthService.checkServices.mockResolvedValue(mockServicesHealth);

      const result = await controller.checkServicesHealth();

      expect(result).toEqual(mockServicesHealth);
      expect(result).toHaveLength(2);
      expect(mockHealthService.checkServices).toHaveBeenCalledTimes(1);
    });

    it('should return mixed service health statuses', async () => {
      const mockServicesHealth: ServiceHealthStatusDto[] = [
        {
          name: 'healthy-service',
          status: 'healthy',
          responseTime: 100,
          lastCheck: '2024-01-15T10:30:00.000Z',
        },
        {
          name: 'unhealthy-service',
          status: 'unhealthy',
          responseTime: 5000,
          lastCheck: '2024-01-15T10:30:01.000Z',
          error: 'Connection timeout',
        },
        {
          name: 'unknown-service',
          status: 'unknown',
          lastCheck: '2024-01-15T10:30:02.000Z',
          error: 'Service not responding',
        },
      ];

      mockHealthService.checkServices.mockResolvedValue(mockServicesHealth);

      const result = await controller.checkServicesHealth();

      expect(result).toEqual(mockServicesHealth);
      expect(result).toHaveLength(3);
      
      const healthyService = result.find(s => s.name === 'healthy-service');
      const unhealthyService = result.find(s => s.name === 'unhealthy-service');
      const unknownService = result.find(s => s.name === 'unknown-service');

      expect(healthyService?.status).toBe('healthy');
      expect(healthyService?.error).toBeUndefined();
      
      expect(unhealthyService?.status).toBe('unhealthy');
      expect(unhealthyService?.error).toBe('Connection timeout');
      
      expect(unknownService?.status).toBe('unknown');
      expect(unknownService?.error).toBe('Service not responding');
    });

    it('should handle service check errors', async () => {
      const error = new Error('Failed to check services');
      mockHealthService.checkServices.mockRejectedValue(error);

      await expect(controller.checkServicesHealth()).rejects.toThrow('Failed to check services');
      expect(mockHealthService.checkServices).toHaveBeenCalledTimes(1);
    });

    it('should handle services without response time', async () => {
      const mockServicesHealth: ServiceHealthStatusDto[] = [
        {
          name: 'service-without-response-time',
          status: 'unhealthy',
          lastCheck: '2024-01-15T10:30:00.000Z',
          error: 'Network error',
        },
      ];

      mockHealthService.checkServices.mockResolvedValue(mockServicesHealth);

      const result = await controller.checkServicesHealth();

      expect(result).toEqual(mockServicesHealth);
      expect(result[0].responseTime).toBeUndefined();
    });

    it('should preserve all service health data fields', async () => {
      const mockServicesHealth: ServiceHealthStatusDto[] = [
        {
          name: 'complete-service',
          status: 'healthy',
          responseTime: 250,
          lastCheck: '2024-01-15T10:30:00.000Z',
        },
      ];

      mockHealthService.checkServices.mockResolvedValue(mockServicesHealth);

      const result = await controller.checkServicesHealth();

      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('status');
      expect(result[0]).toHaveProperty('responseTime');
      expect(result[0]).toHaveProperty('lastCheck');
      expect(result[0].name).toBe('complete-service');
      expect(result[0].status).toBe('healthy');
      expect(result[0].responseTime).toBe(250);
      expect(result[0].lastCheck).toBe('2024-01-15T10:30:00.000Z');
    });
  });
});