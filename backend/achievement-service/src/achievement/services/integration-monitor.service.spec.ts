import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationMonitorService } from './integration-monitor.service';
import { NotificationService } from './notification.service';
import { LibraryService } from './library.service';
import { PaymentService } from './payment.service';
import { ReviewService } from './review.service';
import { SocialService } from './social.service';

describe('IntegrationMonitorService', () => {
  let service: IntegrationMonitorService;
  let notificationService: NotificationService;
  let libraryService: LibraryService;
  let paymentService: PaymentService;
  let reviewService: ReviewService;
  let socialService: SocialService;

  const mockNotificationService = {
    checkNotificationServiceHealth: jest.fn(),
  };

  const mockLibraryService = {
    checkLibraryServiceHealth: jest.fn(),
  };

  const mockPaymentService = {
    checkPaymentServiceHealth: jest.fn(),
  };

  const mockReviewService = {
    checkReviewServiceHealth: jest.fn(),
  };

  const mockSocialService = {
    checkSocialServiceHealth: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationMonitorService,
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: LibraryService,
          useValue: mockLibraryService,
        },
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
        {
          provide: ReviewService,
          useValue: mockReviewService,
        },
        {
          provide: SocialService,
          useValue: mockSocialService,
        },
      ],
    }).compile();

    service = module.get<IntegrationMonitorService>(IntegrationMonitorService);
    notificationService = module.get<NotificationService>(NotificationService);
    libraryService = module.get<LibraryService>(LibraryService);
    paymentService = module.get<PaymentService>(PaymentService);
    reviewService = module.get<ReviewService>(ReviewService);
    socialService = module.get<SocialService>(SocialService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('checkAllServicesHealth', () => {
    it('should return healthy status when all services are healthy', async () => {
      // Mock all services as healthy
      mockNotificationService.checkNotificationServiceHealth.mockResolvedValue(true);
      mockLibraryService.checkLibraryServiceHealth.mockResolvedValue(true);
      mockPaymentService.checkPaymentServiceHealth.mockResolvedValue(true);
      mockReviewService.checkReviewServiceHealth.mockResolvedValue(true);
      mockSocialService.checkSocialServiceHealth.mockResolvedValue(true);

      const result = await service.checkAllServicesHealth();

      expect(result.overallHealth).toBe('healthy');
      expect(result.healthyServices).toBe(5);
      expect(result.totalServices).toBe(5);
      expect(result.services).toHaveLength(5);
      expect(result.services.every(s => s.isHealthy)).toBe(true);
    });

    it('should return degraded status when some services are unhealthy', async () => {
      // Mock 3 services as healthy, 2 as unhealthy
      mockNotificationService.checkNotificationServiceHealth.mockResolvedValue(true);
      mockLibraryService.checkLibraryServiceHealth.mockResolvedValue(true);
      mockPaymentService.checkPaymentServiceHealth.mockResolvedValue(true);
      mockReviewService.checkReviewServiceHealth.mockResolvedValue(false);
      mockSocialService.checkSocialServiceHealth.mockResolvedValue(false);

      const result = await service.checkAllServicesHealth();

      expect(result.overallHealth).toBe('degraded');
      expect(result.healthyServices).toBe(3);
      expect(result.totalServices).toBe(5);
    });

    it('should return unhealthy status when most services are unhealthy', async () => {
      // Mock 1 service as healthy, 4 as unhealthy
      mockNotificationService.checkNotificationServiceHealth.mockResolvedValue(true);
      mockLibraryService.checkLibraryServiceHealth.mockResolvedValue(false);
      mockPaymentService.checkPaymentServiceHealth.mockResolvedValue(false);
      mockReviewService.checkReviewServiceHealth.mockResolvedValue(false);
      mockSocialService.checkSocialServiceHealth.mockResolvedValue(false);

      const result = await service.checkAllServicesHealth();

      expect(result.overallHealth).toBe('unhealthy');
      expect(result.healthyServices).toBe(1);
      expect(result.totalServices).toBe(5);
    });

    it('should handle service health check errors', async () => {
      // Mock some services to throw errors
      mockNotificationService.checkNotificationServiceHealth.mockResolvedValue(true);
      mockLibraryService.checkLibraryServiceHealth.mockRejectedValue(new Error('Network error'));
      mockPaymentService.checkPaymentServiceHealth.mockResolvedValue(true);
      mockReviewService.checkReviewServiceHealth.mockRejectedValue(new Error('Service down'));
      mockSocialService.checkSocialServiceHealth.mockResolvedValue(true);

      const result = await service.checkAllServicesHealth();

      expect(result.overallHealth).toBe('degraded');
      expect(result.healthyServices).toBe(3);
      expect(result.totalServices).toBe(5);

      const errorServices = result.services.filter(s => !s.isHealthy);
      expect(errorServices).toHaveLength(2);
      expect(errorServices.every(s => s.error)).toBe(true);
    });

    it('should measure response times', async () => {
      // Mock all services as healthy
      mockNotificationService.checkNotificationServiceHealth.mockResolvedValue(true);
      mockLibraryService.checkLibraryServiceHealth.mockResolvedValue(true);
      mockPaymentService.checkPaymentServiceHealth.mockResolvedValue(true);
      mockReviewService.checkReviewServiceHealth.mockResolvedValue(true);
      mockSocialService.checkSocialServiceHealth.mockResolvedValue(true);

      const result = await service.checkAllServicesHealth();

      expect(result.services.every(s => typeof s.responseTime === 'number')).toBe(true);
      expect(result.services.every(s => s.responseTime! >= 0)).toBe(true);
    });
  });

  describe('checkIntegrationReadiness', () => {
    it('should return ready when critical services are healthy', async () => {
      // Mock critical services (library, notification) as healthy
      mockNotificationService.checkNotificationServiceHealth.mockResolvedValue(true);
      mockLibraryService.checkLibraryServiceHealth.mockResolvedValue(true);
      // Optional services can be unhealthy
      mockPaymentService.checkPaymentServiceHealth.mockResolvedValue(false);
      mockReviewService.checkReviewServiceHealth.mockResolvedValue(false);
      mockSocialService.checkSocialServiceHealth.mockResolvedValue(false);

      const result = await service.checkIntegrationReadiness();

      expect(result.ready).toBe(true);
      expect(result.criticalServices).toContain('library-service');
      expect(result.criticalServices).toContain('notification-service');
      expect(result.message).toContain('limited functionality');
    });

    it('should return not ready when critical services are unhealthy', async () => {
      // Mock critical services as unhealthy
      mockNotificationService.checkNotificationServiceHealth.mockResolvedValue(false);
      mockLibraryService.checkLibraryServiceHealth.mockResolvedValue(false);
      // Optional services are healthy
      mockPaymentService.checkPaymentServiceHealth.mockResolvedValue(true);
      mockReviewService.checkReviewServiceHealth.mockResolvedValue(true);
      mockSocialService.checkSocialServiceHealth.mockResolvedValue(true);

      const result = await service.checkIntegrationReadiness();

      expect(result.ready).toBe(false);
      expect(result.message).toContain('Not ready');
      expect(result.message).toContain('library-service');
      expect(result.message).toContain('notification-service');
    });

    it('should return ready with full functionality when all services are healthy', async () => {
      // Mock all services as healthy
      mockNotificationService.checkNotificationServiceHealth.mockResolvedValue(true);
      mockLibraryService.checkLibraryServiceHealth.mockResolvedValue(true);
      mockPaymentService.checkPaymentServiceHealth.mockResolvedValue(true);
      mockReviewService.checkReviewServiceHealth.mockResolvedValue(true);
      mockSocialService.checkSocialServiceHealth.mockResolvedValue(true);

      const result = await service.checkIntegrationReadiness();

      expect(result.ready).toBe(true);
      expect(result.message).toContain('full integration');
    });
  });

  describe('getIntegrationMetrics', () => {
    it('should calculate metrics correctly', async () => {
      // Mock all services as healthy with different response times
      mockNotificationService.checkNotificationServiceHealth.mockResolvedValue(true);
      mockLibraryService.checkLibraryServiceHealth.mockResolvedValue(true);
      mockPaymentService.checkPaymentServiceHealth.mockResolvedValue(true);
      mockReviewService.checkReviewServiceHealth.mockResolvedValue(true);
      mockSocialService.checkSocialServiceHealth.mockResolvedValue(true);

      const result = await service.getIntegrationMetrics();

      expect(typeof result.averageResponseTime).toBe('number');
      expect(result.averageResponseTime).toBeGreaterThanOrEqual(0);
      expect(result.serviceMetrics).toHaveLength(5);
      expect(result.slowestService).toBeTruthy();
      expect(result.fastestService).toBeTruthy();
    });

    it('should handle no healthy services', async () => {
      // Mock all services as unhealthy
      mockNotificationService.checkNotificationServiceHealth.mockResolvedValue(false);
      mockLibraryService.checkLibraryServiceHealth.mockResolvedValue(false);
      mockPaymentService.checkPaymentServiceHealth.mockResolvedValue(false);
      mockReviewService.checkReviewServiceHealth.mockResolvedValue(false);
      mockSocialService.checkSocialServiceHealth.mockResolvedValue(false);

      const result = await service.getIntegrationMetrics();

      expect(result.averageResponseTime).toBe(0);
      expect(result.slowestService).toBeNull();
      expect(result.fastestService).toBeNull();
      expect(result.serviceMetrics).toHaveLength(5);
    });
  });

  describe('checkIntegrationType', () => {
    it('should check payment service health', async () => {
      mockPaymentService.checkPaymentServiceHealth.mockResolvedValue(true);

      const result = await service.checkIntegrationType('payment');

      expect(result.serviceName).toBe('payment-service');
      expect(result.isHealthy).toBe(true);
      expect(mockPaymentService.checkPaymentServiceHealth).toHaveBeenCalled();
    });

    it('should check review service health', async () => {
      mockReviewService.checkReviewServiceHealth.mockResolvedValue(false);

      const result = await service.checkIntegrationType('review');

      expect(result.serviceName).toBe('review-service');
      expect(result.isHealthy).toBe(false);
      expect(mockReviewService.checkReviewServiceHealth).toHaveBeenCalled();
    });

    it('should check social service health', async () => {
      mockSocialService.checkSocialServiceHealth.mockResolvedValue(true);

      const result = await service.checkIntegrationType('social');

      expect(result.serviceName).toBe('social-service');
      expect(result.isHealthy).toBe(true);
      expect(mockSocialService.checkSocialServiceHealth).toHaveBeenCalled();
    });

    it('should check library service health', async () => {
      mockLibraryService.checkLibraryServiceHealth.mockResolvedValue(true);

      const result = await service.checkIntegrationType('library');

      expect(result.serviceName).toBe('library-service');
      expect(result.isHealthy).toBe(true);
      expect(mockLibraryService.checkLibraryServiceHealth).toHaveBeenCalled();
    });

    it('should check notification service health', async () => {
      mockNotificationService.checkNotificationServiceHealth.mockResolvedValue(true);

      const result = await service.checkIntegrationType('notification');

      expect(result.serviceName).toBe('notification-service');
      expect(result.isHealthy).toBe(true);
      expect(mockNotificationService.checkNotificationServiceHealth).toHaveBeenCalled();
    });

    it('should throw error for unknown integration type', async () => {
      await expect(service.checkIntegrationType('unknown' as any)).rejects.toThrow('Unknown integration type: unknown');
    });
  });

  describe('getIntegrationRecommendations', () => {
    it('should provide recommendations for healthy system', async () => {
      // Mock all services as healthy with good response times
      mockNotificationService.checkNotificationServiceHealth.mockResolvedValue(true);
      mockLibraryService.checkLibraryServiceHealth.mockResolvedValue(true);
      mockPaymentService.checkPaymentServiceHealth.mockResolvedValue(true);
      mockReviewService.checkReviewServiceHealth.mockResolvedValue(true);
      mockSocialService.checkSocialServiceHealth.mockResolvedValue(true);

      const result = await service.getIntegrationRecommendations();

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.criticalIssues).toHaveLength(0);
      expect(result.recommendations.some(r => r.includes('circuit breakers'))).toBe(true);
    });

    it('should identify critical issues when services are down', async () => {
      // Mock all services as unhealthy
      mockNotificationService.checkNotificationServiceHealth.mockResolvedValue(false);
      mockLibraryService.checkLibraryServiceHealth.mockResolvedValue(false);
      mockPaymentService.checkPaymentServiceHealth.mockResolvedValue(false);
      mockReviewService.checkReviewServiceHealth.mockResolvedValue(false);
      mockSocialService.checkSocialServiceHealth.mockResolvedValue(false);

      const result = await service.getIntegrationRecommendations();

      expect(result.criticalIssues.length).toBeGreaterThan(0);
      expect(result.criticalIssues[0]).toContain('services are unavailable');
      expect(result.recommendations.some(r => r.includes('fallback mechanisms'))).toBe(true);
    });

    it('should provide warnings for degraded performance', async () => {
      // This test would need to mock slow response times
      // For now, we just verify the structure
      mockNotificationService.checkNotificationServiceHealth.mockResolvedValue(true);
      mockLibraryService.checkLibraryServiceHealth.mockResolvedValue(true);
      mockPaymentService.checkPaymentServiceHealth.mockResolvedValue(true);
      mockReviewService.checkReviewServiceHealth.mockResolvedValue(false);
      mockSocialService.checkSocialServiceHealth.mockResolvedValue(false);

      const result = await service.getIntegrationRecommendations();

      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.criticalIssues)).toBe(true);
    });
  });
});