import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

const mockHealthService = {
  check: jest.fn(),
  checkDatabase: jest.fn(),
  checkRedis: jest.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

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
    service = module.get<HealthService>(HealthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return health status', async () => {
      const healthStatus = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };

      mockHealthService.check.mockResolvedValue(healthStatus);

      const result = await controller.check();

      expect(result).toEqual(healthStatus);
      expect(service.check).toHaveBeenCalled();
    });
  });

  describe('checkDatabase', () => {
    it('should return database health status', async () => {
      const dbHealth = {
        status: 'ok',
        database: 'connected',
      };

      mockHealthService.checkDatabase.mockResolvedValue(dbHealth);

      const result = await controller.checkDatabase();

      expect(result).toEqual(dbHealth);
      expect(service.checkDatabase).toHaveBeenCalled();
    });
  });

  describe('checkRedis', () => {
    it('should return redis health status', async () => {
      const redisHealth = {
        status: 'ok',
        redis: 'connected',
      };

      mockHealthService.checkRedis.mockResolvedValue(redisHealth);

      const result = await controller.checkRedis();

      expect(result).toEqual(redisHealth);
      expect(service.checkRedis).toHaveBeenCalled();
    });
  });
});
