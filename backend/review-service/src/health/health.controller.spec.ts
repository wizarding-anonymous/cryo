import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: HealthService;

  const mockHealthService = {
    getBasicHealth: jest.fn(),
    getDetailedHealth: jest.fn(),
    getReadiness: jest.fn(),
    getLiveness: jest.fn(),
  };

  beforeEach(async () => {
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
    healthService = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return basic health status', async () => {
      const mockHealth = {
        status: 'healthy' as const,
        timestamp: '2023-01-01T00:00:00.000Z',
        uptime: 1000,
        version: '1.0.0',
      };

      mockHealthService.getBasicHealth.mockResolvedValue(mockHealth);

      const result = await controller.getHealth();

      expect(result).toEqual(mockHealth);
      expect(mockHealthService.getBasicHealth).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDetailedHealth', () => {
    it('should return detailed health status', async () => {
      const mockDetailedHealth = {
        status: 'healthy' as const,
        timestamp: '2023-01-01T00:00:00.000Z',
        uptime: 1000,
        version: '1.0.0',
        database: {
          status: 'healthy' as const,
          responseTime: 50,
        },
        services: {
          libraryService: true,
          notificationService: true,
          gameCatalogService: true,
          achievementService: true,
        },
        metrics: {
          totalReviews: 100,
          totalRatings: 50,
        },
      };

      mockHealthService.getDetailedHealth.mockResolvedValue(mockDetailedHealth);

      const result = await controller.getDetailedHealth();

      expect(result).toEqual(mockDetailedHealth);
      expect(mockHealthService.getDetailedHealth).toHaveBeenCalledTimes(1);
    });
  });

  describe('getReadiness', () => {
    it('should return readiness status', async () => {
      const mockReadiness = {
        status: 'healthy' as const,
        timestamp: '2023-01-01T00:00:00.000Z',
        uptime: 1000,
      };

      mockHealthService.getReadiness.mockResolvedValue(mockReadiness);

      const result = await controller.getReadiness();

      expect(result).toEqual(mockReadiness);
      expect(mockHealthService.getReadiness).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLiveness', () => {
    it('should return liveness status', async () => {
      const mockLiveness = {
        status: 'healthy' as const,
        timestamp: '2023-01-01T00:00:00.000Z',
        uptime: 1000,
      };

      mockHealthService.getLiveness.mockResolvedValue(mockLiveness);

      const result = await controller.getLiveness();

      expect(result).toEqual(mockLiveness);
      expect(mockHealthService.getLiveness).toHaveBeenCalledTimes(1);
    });
  });
});