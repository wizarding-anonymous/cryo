import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

import { ExternalIntegrationService } from '../services/external-integration.service';
import { OwnershipService } from '../services/ownership.service';
import { ReviewService } from '../services/review.service';
import { RatingService } from '../services/rating.service';
import { WebhookService } from '../webhooks/webhook.service';
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';
import { MetricsService } from '../services/metrics.service';
import {
  AchievementWebhookDto,
  NotificationWebhookDto,
  GameCatalogWebhookDto,
  LibraryWebhookDto,
} from '../dto/webhook.dto';

describe('MVP Service Integrations', () => {
  let externalIntegrationService: ExternalIntegrationService;
  let ownershipService: OwnershipService;
  let reviewService: ReviewService;
  let ratingService: RatingService;
  let webhookService: WebhookService;
  let httpService: HttpService;
  let reviewRepository: Repository<Review>;
  let gameRatingRepository: Repository<GameRating>;
  let cacheManager: any;

  const mockHttpService = {
    request: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'app.services.library': 'http://library-service:3001',
        'app.services.gameCatalog': 'http://game-catalog-service:3002',
        'app.services.achievement': 'http://achievement-service:3003',
        'app.services.notification': 'http://notification-service:3004',
        WEBHOOK_SECRET: 'test-webhook-secret',
      };
      return config[key];
    }),
  };

  const mockReviewRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockGameRatingRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockMetricsService = {
    recordWebhookReceived: jest.fn(),
    recordWebhookProcessed: jest.fn(),
    recordRatingCalculation: jest.fn(),
    recordRatingCalculationDuration: jest.fn(),
    incrementActiveCalculations: jest.fn(),
    decrementActiveCalculations: jest.fn(),
    recordCacheOperation: jest.fn(),
    recordCacheOperationDuration: jest.fn(),
    getWebhookMetricsSummary: jest.fn(),
    getRatingMetricsSummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExternalIntegrationService,
        OwnershipService,
        ReviewService,
        RatingService,
        WebhookService,
        MetricsService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: getRepositoryToken(Review),
          useValue: mockReviewRepository,
        },
        {
          provide: getRepositoryToken(GameRating),
          useValue: mockGameRatingRepository,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    externalIntegrationService = module.get<ExternalIntegrationService>(ExternalIntegrationService);
    ownershipService = module.get<OwnershipService>(OwnershipService);
    reviewService = module.get<ReviewService>(ReviewService);
    ratingService = module.get<RatingService>(RatingService);
    webhookService = module.get<WebhookService>(WebhookService);
    httpService = module.get<HttpService>(HttpService);
    reviewRepository = module.get<Repository<Review>>(getRepositoryToken(Review));
    gameRatingRepository = module.get<Repository<GameRating>>(getRepositoryToken(GameRating));
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Library Service Integration', () => {
    it('should check game ownership successfully', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';
      const mockResponse: AxiosResponse = {
        data: {
          ownsGame: true,
          purchaseDate: '2024-01-01T00:00:00.000Z',
          gameId,
          userId,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.request.mockReturnValue(of(mockResponse));
      mockCacheManager.get.mockResolvedValue(undefined);

      const result = await ownershipService.checkGameOwnership(userId, gameId);

      expect(result).toBe(true);
      expect(mockHttpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'http://library-service:3001/api/v1/library/user-123/games/game-456/ownership',
          timeout: 5000,
        })
      );
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'ownership_user-123_game-456',
        true,
        600
      );
    });

    it('should handle ownership check failure gracefully', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';

      mockHttpService.request.mockReturnValue(
        throwError(() => new Error('Service unavailable'))
      );
      mockCacheManager.get.mockResolvedValue(undefined);

      const result = await ownershipService.checkGameOwnership(userId, gameId);

      expect(result).toBe(false);
    });

    it('should process library webhook for game purchase', async () => {
      const webhookData: LibraryWebhookDto = {
        userId: 'user-123',
        gameId: 'game-456',
        eventType: 'GAME_PURCHASED',
        timestamp: '2024-01-01T00:00:00.000Z',
        metadata: { purchasePrice: 29.99 },
      };

      const result = await webhookService.processLibraryWebhook(webhookData);

      expect(result.processed).toBe(true);
      expect(result.message).toContain('GAME_PURCHASED');
      expect(mockMetricsService.recordWebhookReceived).toHaveBeenCalledWith(
        'library',
        'GAME_PURCHASED'
      );
      expect(mockMetricsService.recordWebhookProcessed).toHaveBeenCalledWith(
        'library',
        'success'
      );
    });
  });

  describe('Game Catalog Service Integration', () => {
    it('should update game rating in catalog successfully', async () => {
      const gameId = 'game-123';
      const averageRating = 4.5;
      const totalReviews = 100;

      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.request.mockReturnValue(of(mockResponse));

      await externalIntegrationService.updateGameCatalogRating(
        gameId,
        averageRating,
        totalReviews
      );

      expect(mockHttpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          url: 'http://game-catalog-service:3002/api/v1/games/game-123/rating',
          data: expect.objectContaining({
            gameId,
            averageRating,
            totalReviews,
            timestamp: expect.any(String),
          }),
          timeout: 5000,
        })
      );
    });

    it('should validate game existence', async () => {
      const gameId = 'game-123';
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.request.mockReturnValue(of(mockResponse));

      const result = await externalIntegrationService.validateGameExists(gameId);

      expect(result).toBe(true);
      expect(mockHttpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'HEAD',
          url: 'http://game-catalog-service:3002/api/v1/games/game-123',
          timeout: 5000,
        })
      );
    });

    it('should process game catalog webhook for rating sync', async () => {
      const webhookData: GameCatalogWebhookDto = {
        gameId: 'game-123',
        syncStatus: 'success',
        averageRating: 4.5,
        totalReviews: 100,
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      mockGameRatingRepository.findOne.mockResolvedValue({
        gameId: 'game-123',
        averageRating: 4.5,
        totalReviews: 100,
        updatedAt: new Date(),
      });

      const result = await webhookService.processGameCatalogWebhook(webhookData);

      expect(result.processed).toBe(true);
      expect(result.message).toContain('success');
      expect(mockMetricsService.recordWebhookReceived).toHaveBeenCalledWith(
        'game_catalog',
        'rating_sync'
      );
    });
  });

  describe('Achievement Service Integration', () => {
    it('should notify achievement service about first review', async () => {
      const userId = 'user-123';
      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.request.mockReturnValue(of(mockResponse));

      await externalIntegrationService.notifyFirstReviewAchievement(userId);

      expect(mockHttpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'http://achievement-service:3003/api/v1/achievements/unlock',
          data: expect.objectContaining({
            userId,
            achievementType: 'FIRST_REVIEW',
            timestamp: expect.any(String),
            metadata: {
              source: 'review-service',
            },
          }),
          timeout: 5000,
        })
      );
    });

    it('should process achievement webhook for first review', async () => {
      const webhookData: AchievementWebhookDto = {
        userId: 'user-123',
        achievementType: 'FIRST_REVIEW',
        timestamp: '2024-01-01T00:00:00.000Z',
        metadata: { source: 'review-service' },
      };

      mockReviewRepository.count.mockResolvedValue(1);

      const result = await webhookService.processAchievementWebhook(webhookData);

      expect(result.processed).toBe(true);
      expect(result.message).toContain('confirmed');
      expect(mockMetricsService.recordWebhookReceived).toHaveBeenCalledWith(
        'achievement',
        'FIRST_REVIEW'
      );
    });

    it('should handle achievement webhook mismatch', async () => {
      const webhookData: AchievementWebhookDto = {
        userId: 'user-123',
        achievementType: 'FIRST_REVIEW',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      mockReviewRepository.count.mockResolvedValue(0);

      const result = await webhookService.processAchievementWebhook(webhookData);

      expect(result.processed).toBe(false);
      expect(result.message).toContain('mismatch');
      expect(mockMetricsService.recordWebhookProcessed).toHaveBeenCalledWith(
        'achievement',
        'mismatch'
      );
    });
  });

  describe('Notification Service Integration', () => {
    it('should notify about new review', async () => {
      const review = {
        id: 'review-123',
        userId: 'user-456',
        gameId: 'game-789',
        rating: 5,
        text: 'Great game!',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Review;

      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.request.mockReturnValue(of(mockResponse));

      await externalIntegrationService.notifyReviewAction(review, 'created');

      expect(mockHttpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'http://notification-service:3004/api/v1/notifications/review-action',
          data: expect.objectContaining({
            reviewId: review.id,
            userId: review.userId,
            gameId: review.gameId,
            rating: review.rating,
            timestamp: expect.any(String),
            action: 'created',
          }),
          timeout: 5000,
        })
      );
    });

    it('should process notification webhook', async () => {
      const webhookData: NotificationWebhookDto = {
        reviewId: 'review-123',
        notificationType: 'NEW_REVIEW',
        status: 'sent',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      mockReviewRepository.findOne.mockResolvedValue({
        id: 'review-123',
        userId: 'user-456',
        gameId: 'game-789',
        rating: 5,
        text: 'Great game!',
      });

      const result = await webhookService.processNotificationWebhook(webhookData);

      expect(result.processed).toBe(true);
      expect(result.message).toContain('sent');
      expect(mockMetricsService.recordWebhookReceived).toHaveBeenCalledWith(
        'notification',
        'NEW_REVIEW'
      );
    });
  });

  describe('End-to-End Integration Scenarios', () => {
    it('should handle complete review creation flow with all integrations', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';
      const createReviewDto = {
        gameId,
        text: 'Amazing game!',
        rating: 5,
      };

      // Mock game existence check
      const gameExistsResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.request.mockReturnValueOnce(of(gameExistsResponse));

      // Mock ownership check
      const ownershipResponse: AxiosResponse = {
        data: { ownsGame: true, gameId, userId },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.request.mockReturnValueOnce(of(ownershipResponse));

      // Mock review creation
      mockReviewRepository.findOne.mockResolvedValue(null); // No existing review
      mockReviewRepository.create.mockReturnValue({
        id: 'review-123',
        userId,
        gameId,
        text: createReviewDto.text,
        rating: createReviewDto.rating,
      });
      mockReviewRepository.save.mockResolvedValue({
        id: 'review-123',
        userId,
        gameId,
        text: createReviewDto.text,
        rating: createReviewDto.rating,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock rating calculation
      mockReviewRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          averageRating: '4.5',
          totalReviews: '10',
        }),
      });

      // Mock rating save
      mockGameRatingRepository.findOne.mockResolvedValue(null);
      mockGameRatingRepository.create.mockReturnValue({
        gameId,
        averageRating: 4.5,
        totalReviews: 10,
      });
      mockGameRatingRepository.save.mockResolvedValue({
        gameId,
        averageRating: 4.5,
        totalReviews: 10,
        updatedAt: new Date(),
      });

      // Mock first review check
      mockReviewRepository.count.mockResolvedValue(1);

      // Mock external service calls
      const achievementResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.request.mockReturnValueOnce(of(achievementResponse));

      const notificationResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.request.mockReturnValueOnce(of(notificationResponse));

      const catalogResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.request.mockReturnValueOnce(of(catalogResponse));

      // Execute the complete flow
      const result = await reviewService.createReview(userId, createReviewDto);

      // Verify the result
      expect(result).toBeDefined();
      expect(result.id).toBe('review-123');
      expect(result.userId).toBe(userId);
      expect(result.gameId).toBe(gameId);

      // Verify all integrations were called
      expect(mockHttpService.request).toHaveBeenCalledTimes(5); // Game exists, ownership, achievement, notification, catalog
    });

    it('should handle service health check for all integrations', async () => {
      // Mock successful health checks for all services
      const healthResponse: AxiosResponse = {
        data: { status: 'healthy' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.request.mockReturnValue(of(healthResponse));

      const healthStatus = await externalIntegrationService.healthCheck();

      expect(healthStatus).toEqual({
        library: true,
        gameCatalog: true,
        achievement: true,
        notification: true,
      });

      expect(mockHttpService.request).toHaveBeenCalledTimes(4);
    });

    it('should handle partial service failures gracefully', async () => {
      // Mock mixed health check results
      mockHttpService.request
        .mockReturnValueOnce(of({ data: {}, status: 200 } as AxiosResponse)) // library - success
        .mockReturnValueOnce(throwError(() => new Error('Service down'))) // gameCatalog - failure
        .mockReturnValueOnce(of({ data: {}, status: 200 } as AxiosResponse)) // achievement - success
        .mockReturnValueOnce(throwError(() => new Error('Service down'))); // notification - failure

      const healthStatus = await externalIntegrationService.healthCheck();

      expect(healthStatus).toEqual({
        library: true,
        gameCatalog: false,
        achievement: true,
        notification: false,
      });
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle high load with proper caching', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';

      // First call - cache miss
      mockCacheManager.get.mockResolvedValueOnce(undefined);
      const ownershipResponse: AxiosResponse = {
        data: { ownsGame: true, gameId, userId },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.request.mockReturnValueOnce(of(ownershipResponse));

      const result1 = await ownershipService.checkGameOwnership(userId, gameId);

      // Second call - cache hit
      mockCacheManager.get.mockResolvedValueOnce(true);

      const result2 = await ownershipService.checkGameOwnership(userId, gameId);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(mockHttpService.request).toHaveBeenCalledTimes(1); // Only first call hits the service
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'ownership_user-123_game-456',
        true,
        600
      );
    });

    it('should handle retry logic for external service failures', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';

      mockCacheManager.get.mockResolvedValue(undefined);

      // First two calls fail, third succeeds
      mockHttpService.request
        .mockReturnValueOnce(throwError(() => new Error('Temporary failure')))
        .mockReturnValueOnce(throwError(() => new Error('Temporary failure')))
        .mockReturnValueOnce(of({
          data: { ownsGame: true, gameId, userId },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        } as AxiosResponse));

      const result = await ownershipService.checkGameOwnership(userId, gameId);

      expect(result).toBe(true);
      expect(mockHttpService.request).toHaveBeenCalledTimes(3);
    });
  });
});