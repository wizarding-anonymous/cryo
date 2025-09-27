import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

describe('MonitoringController', () => {
  let controller: MonitoringController;
  let monitoringService: MonitoringService;

  const mockMonitoringService = {
    getMonitoringMetrics: jest.fn(),
    getServiceStatus: jest.fn(),
    triggerHealthCheck: jest.fn(),
    resetErrorCounts: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MonitoringController],
      providers: [
        {
          provide: MonitoringService,
          useValue: mockMonitoringService,
        },
      ],
    }).compile();

    controller = module.get<MonitoringController>(MonitoringController);
    monitoringService = module.get<MonitoringService>(MonitoringService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getServiceMetrics', () => {
    it('should return service monitoring metrics', () => {
      const mockMetrics = {
        services: [
          {
            name: 'libraryService',
            status: 'healthy' as const,
            lastCheck: new Date(),
            errorCount: 0,
            uptime: 100,
          },
        ],
        overallHealth: 'healthy' as const,
        lastUpdate: new Date(),
      };

      mockMonitoringService.getMonitoringMetrics.mockReturnValue(mockMetrics);

      const result = controller.getServiceMetrics();

      expect(result).toEqual(mockMetrics);
      expect(mockMonitoringService.getMonitoringMetrics).toHaveBeenCalledTimes(1);
    });
  });

  describe('getServiceStatus', () => {
    it('should return specific service status', () => {
      const serviceName = 'libraryService';
      const mockStatus = {
        name: serviceName,
        status: 'healthy' as const,
        lastCheck: new Date(),
        errorCount: 0,
        uptime: 100,
      };

      mockMonitoringService.getServiceStatus.mockReturnValue(mockStatus);

      const result = controller.getServiceStatus(serviceName);

      expect(result).toEqual(mockStatus);
      expect(mockMonitoringService.getServiceStatus).toHaveBeenCalledWith(serviceName);
    });

    it('should throw NotFoundException when service not found', () => {
      const serviceName = 'nonexistentService';
      mockMonitoringService.getServiceStatus.mockReturnValue(undefined);

      expect(() => controller.getServiceStatus(serviceName)).toThrow(NotFoundException);
      expect(mockMonitoringService.getServiceStatus).toHaveBeenCalledWith(serviceName);
    });
  });

  describe('triggerHealthCheck', () => {
    it('should trigger manual health check', async () => {
      const mockMetrics = {
        services: [],
        overallHealth: 'healthy' as const,
        lastUpdate: new Date(),
      };

      mockMonitoringService.triggerHealthCheck.mockResolvedValue(mockMetrics);

      const result = await controller.triggerHealthCheck();

      expect(result).toEqual(mockMetrics);
      expect(mockMonitoringService.triggerHealthCheck).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetErrorCounts', () => {
    it('should reset error counts for all services', () => {
      const result = controller.resetErrorCounts();

      expect(result).toEqual({ message: 'Error counts reset successfully' });
      expect(mockMonitoringService.resetErrorCounts).toHaveBeenCalledTimes(1);
    });
  });
});