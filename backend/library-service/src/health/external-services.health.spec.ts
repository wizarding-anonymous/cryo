import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExternalServicesHealthIndicator } from './external-services.health';
import { GameCatalogClient } from '../clients/game-catalog.client';
import { PaymentServiceClient } from '../clients/payment-service.client';
import { UserServiceClient } from '../clients/user.client';

describe('ExternalServicesHealthIndicator', () => {
  let service: ExternalServicesHealthIndicator;
  let gameCatalogClient: jest.Mocked<GameCatalogClient>;
  let paymentServiceClient: jest.Mocked<PaymentServiceClient>;
  let userServiceClient: jest.Mocked<UserServiceClient>;

  beforeEach(async () => {
    const mockGameCatalogClient = {
      doesGameExist: jest.fn(),
    };

    const mockPaymentServiceClient = {
      getOrderStatus: jest.fn(),
    };

    const mockUserServiceClient = {
      doesUserExist: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExternalServicesHealthIndicator,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: GameCatalogClient,
          useValue: mockGameCatalogClient,
        },
        {
          provide: PaymentServiceClient,
          useValue: mockPaymentServiceClient,
        },
        {
          provide: UserServiceClient,
          useValue: mockUserServiceClient,
        },
      ],
    }).compile();

    service = module.get<ExternalServicesHealthIndicator>(
      ExternalServicesHealthIndicator,
    );
    gameCatalogClient = module.get(GameCatalogClient);
    paymentServiceClient = module.get(PaymentServiceClient);
    userServiceClient = module.get(UserServiceClient);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkGameCatalogService', () => {
    it('should return healthy status when service is operational', async () => {
      gameCatalogClient.doesGameExist.mockResolvedValue(false);

      const result = await service.checkGameCatalogService('game-catalog');

      expect(result).toEqual({
        'game-catalog': {
          status: 'up',
          responseTime: expect.any(Number),
          healthStatus: 'operational',
        },
      });
    });

    it('should return unhealthy status when service fails', async () => {
      const error = new Error('Service unavailable');
      gameCatalogClient.doesGameExist.mockRejectedValue(error);

      const result = await service.checkGameCatalogService('game-catalog');

      expect(result).toEqual({
        'game-catalog': {
          status: 'down',
          responseTime: expect.any(Number),
          error: 'Service unavailable',
          circuitBreakerOpen: false,
          healthStatus: 'degraded',
        },
      });
    });

    it('should detect circuit breaker open state', async () => {
      const error = new Error(
        'Circuit breaker is OPEN - GameCatalog service unavailable',
      );
      gameCatalogClient.doesGameExist.mockRejectedValue(error);

      const result = await service.checkGameCatalogService('game-catalog');

      expect(result).toEqual({
        'game-catalog': {
          status: 'down',
          responseTime: expect.any(Number),
          error: 'Circuit breaker is OPEN - GameCatalog service unavailable',
          circuitBreakerOpen: true,
          healthStatus: 'degraded',
        },
      });
    });
  });

  describe('checkPaymentService', () => {
    it('should return healthy status when service is operational', async () => {
      paymentServiceClient.getOrderStatus.mockResolvedValue({
        status: 'completed',
      });

      const result = await service.checkPaymentService('payment');

      expect(result).toEqual({
        payment: {
          status: 'up',
          responseTime: expect.any(Number),
          healthStatus: 'operational',
        },
      });
    });

    it('should return unhealthy status when service fails', async () => {
      const error = new Error('Payment service error');
      paymentServiceClient.getOrderStatus.mockRejectedValue(error);

      const result = await service.checkPaymentService('payment');

      expect(result).toEqual({
        payment: {
          status: 'down',
          responseTime: expect.any(Number),
          error: 'Payment service error',
          circuitBreakerOpen: false,
          healthStatus: 'degraded',
        },
      });
    });
  });

  describe('checkUserService', () => {
    it('should return healthy status when service is operational', async () => {
      userServiceClient.doesUserExist.mockResolvedValue(false);

      const result = await service.checkUserService('user');

      expect(result).toEqual({
        user: {
          status: 'up',
          responseTime: expect.any(Number),
          healthStatus: 'operational',
        },
      });
    });

    it('should return unhealthy status when service fails', async () => {
      const error = new Error('User service error');
      userServiceClient.doesUserExist.mockRejectedValue(error);

      const result = await service.checkUserService('user');

      expect(result).toEqual({
        user: {
          status: 'down',
          responseTime: expect.any(Number),
          error: 'User service error',
          circuitBreakerOpen: false,
          healthStatus: 'degraded',
        },
      });
    });
  });

  describe('checkAllExternalServices', () => {
    it('should return overall healthy status when all services are operational', async () => {
      gameCatalogClient.doesGameExist.mockResolvedValue(false);
      paymentServiceClient.getOrderStatus.mockResolvedValue({
        status: 'completed',
      });
      userServiceClient.doesUserExist.mockResolvedValue(false);

      const result =
        await service.checkAllExternalServices('external-services');

      expect(result['external-services'].status).toBe('up');
      expect(result['external-services'].services).toEqual({
        'game-catalog': {
          isHealthy: true,
          responseTime: expect.any(Number),
          circuitBreakerState: 'CLOSED',
        },
        payment: {
          isHealthy: true,
          responseTime: expect.any(Number),
          circuitBreakerState: 'CLOSED',
        },
        user: {
          isHealthy: true,
          responseTime: expect.any(Number),
          circuitBreakerState: 'CLOSED',
        },
      });
    });

    it('should return overall unhealthy status when any service fails', async () => {
      gameCatalogClient.doesGameExist.mockResolvedValue(false);
      paymentServiceClient.getOrderStatus.mockRejectedValue(
        new Error('Payment error'),
      );
      userServiceClient.doesUserExist.mockResolvedValue(false);

      const result =
        await service.checkAllExternalServices('external-services');

      expect(result['external-services'].status).toBe('down');
      expect(result['external-services'].summary).toEqual({
        total: 3,
        healthy: 2,
        degraded: 1,
      });
    });
  });
});
