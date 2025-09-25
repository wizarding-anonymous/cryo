import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { BackgroundTasksService } from '../services/background-tasks.service';
import { MetricsService } from '../services/metrics.service';

describe('AdminController', () => {
  let controller: AdminController;
  let backgroundTasksService: jest.Mocked<BackgroundTasksService>;
  let metricsService: jest.Mocked<MetricsService>;

  beforeEach(async () => {
    const mockBackgroundTasksService = {
      recalculateAllGameRatings: jest.fn(),
      getRecalculationStatus: jest.fn(),
    };

    const mockMetricsService = {
      getMetricsSummary: jest.fn(),
      getMetrics: jest.fn(),
      clearMetrics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: BackgroundTasksService,
          useValue: mockBackgroundTasksService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    backgroundTasksService = module.get(BackgroundTasksService);
    metricsService = module.get(MetricsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('recalculateAllRatings', () => {
    it('should trigger recalculation and return results', async () => {
      const mockResult = {
        totalGames: 10,
        successfulUpdates: 9,
        failedUpdates: 1,
        duration: 5000,
      };

      backgroundTasksService.recalculateAllGameRatings.mockResolvedValue(mockResult);

      const result = await controller.recalculateAllRatings();

      expect(result).toEqual(mockResult);
      expect(backgroundTasksService.recalculateAllGameRatings).toHaveBeenCalled();
    });

    it('should propagate errors from background service', async () => {
      const error = new Error('Recalculation already in progress');
      backgroundTasksService.recalculateAllGameRatings.mockRejectedValue(error);

      await expect(controller.recalculateAllRatings()).rejects.toThrow('Recalculation already in progress');
    });
  });

  describe('getRecalculationStatus', () => {
    it('should return recalculation status', async () => {
      const mockStatus = {
        inProgress: false,
        lastMetrics: {
          totalOperations: 100,
          averageDuration: 150,
          successRate: 95,
          operationCounts: { calculate: 50, update: 50 },
          recentErrors: [],
        },
      };

      backgroundTasksService.getRecalculationStatus.mockResolvedValue(mockStatus);

      const result = await controller.getRecalculationStatus();

      expect(result).toEqual(mockStatus);
      expect(backgroundTasksService.getRecalculationStatus).toHaveBeenCalled();
    });
  });

  describe('getMetrics', () => {
    it('should return metrics summary', async () => {
      const mockMetrics = {
        totalOperations: 100,
        averageDuration: 150,
        successRate: 95,
        operationCounts: { calculate: 50, update: 50 },
        recentErrors: [],
      };

      metricsService.getMetricsSummary.mockReturnValue(mockMetrics);

      const result = await controller.getMetrics();

      expect(result).toEqual(mockMetrics);
      expect(metricsService.getMetricsSummary).toHaveBeenCalled();
    });
  });

  describe('getRawMetrics', () => {
    it('should return raw metrics data', async () => {
      const mockRawMetrics = [
        {
          operationType: 'calculate' as const,
          gameId: 'game-1',
          duration: 100,
          timestamp: new Date(),
          success: true,
        },
        {
          operationType: 'update' as const,
          gameId: 'game-2',
          duration: 200,
          timestamp: new Date(),
          success: false,
          error: 'Test error',
        },
      ];

      metricsService.getMetrics.mockReturnValue(mockRawMetrics);

      const result = await controller.getRawMetrics();

      expect(result).toEqual(mockRawMetrics);
      expect(metricsService.getMetrics).toHaveBeenCalled();
    });
  });

  describe('clearMetrics', () => {
    it('should clear metrics and return success message', async () => {
      const result = await controller.clearMetrics();

      expect(result).toEqual({ message: 'Metrics cleared successfully' });
      expect(metricsService.clearMetrics).toHaveBeenCalled();
    });
  });
});