import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

import { ReviewService } from '../services/review.service';
import { RatingService } from '../services/rating.service';
import { OwnershipService } from '../services/ownership.service';
import { AchievementService } from '../services/achievement.service';
import { NotificationService } from '../services/notification.service';
import { GameCatalogService } from '../services/game-catalog.service';
import { ExternalController } from '../controllers/external.controller';
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';
import { CreateReviewDto } from '../dto';
import { MetricsService } from '../services/metrics.service';

/**
 * Integration tests for MVP services as specified in task 10:
 * - Create webhook to notify Achievement Service about first review creation
 * - Integrate with Notification Service for new review notifications  
 * - Add API for Game Catalog Service to get game ratings
 * - Create integration with Library Service for game ownership verification
 * - Test all integrations within MVP scope
 */
describe('MVP Services Integration Tests', () => {
  let reviewService: ReviewService;
  let ratingService: RatingService;
  let ownershipService: OwnershipService;
  let achievementService: AchievementService;
  let notificationService: NotificationService;
  let gameCatalogService: GameCatalogService;
  let externalController: ExternalController;
  let httpService: HttpService;

  const mockHttpService = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        LIBRARY_SERVICE_URL: 'http://library-service:3000',
        ACHIEVEMENT_SERVICE_URL: 'http://achievement-service:3000',
        NOTIFICATION_SERVICE_URL: 'http://notification-service:3000',
        GAME_CATALOG_SERVICE_URL: 'http://game-catalog-service:3000',
        OWNERSHIP_REQUEST_TIMEOUT: 100,
        ACHIEVEMENT_REQUEST_TIMEOUT: 100,
        NOTIFICATION_REQUEST_TIMEOUT: 100,
        GAME_CATALOG_REQUEST_TIMEOUT: 100,
        OWNERSHIP_MAX_RETRIES: 0,
        ACHIEVEMENT_MAX_RETRIES: 0,
        NOTIFICATION_MAX_RETRIES: 0,
        GAME_CATALOG_MAX_RETRIES: 0,
        OWNERSHIP_CACHE_TIMEOUT: 600,
        OWNERSHIP_NEGATIVE_CACHE_TIMEOUT: 300,
      };
      return config[key] || defaultValue;
    }),
  };

  const mockReviewRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
    })),
  };

  const mockGameRatingRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
    })),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockMetricsService = {
    measureOperation: jest.fn((operationType, operation, gameId) => operation()),
    recordMetric: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExternalController],
      providers: [
        ReviewService,
        RatingService,
        OwnershipService,
        AchievementService,
        NotificationService,
        GameCatalogService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
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
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    reviewService = module.get<ReviewService>(ReviewService);
    ratingService = module.get<RatingService>(RatingService);
    ownershipService = module.get<OwnershipService>(OwnershipService);
    achievementService = module.get<AchievementService>(AchievementService);
    notificationService = module.get<NotificationService>(NotificationService);
    gameCatalogService = module.get<GameCatalogService>(GameCatalogService);
    externalController = module.get<ExternalController>(ExternalController);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Library Service Integration - Game Ownership Verification', () => {
    it('should verify game ownership through Library Service before allowing review creation', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';

      // Mock Library Service response - user owns the game
      const ownershipResponse: AxiosResponse = {
        data: { owned: true, gameId, userId, purchaseDate: '2023-01-01T00:00:00Z' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(ownershipResponse));
      mockCacheManager.get.mockResolvedValue(undefined);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await ownershipService.checkGameOwnership(userId, gameId);

      expect(result).toBe(true);
      expect(mockHttpService.get).toHaveBeenCalledWith(
        `http://library-service:3000/library/user/${userId}/game/${gameId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          }),
        })
      );
    });

    it('should deny review creation when user does not own the game', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';

      // Mock Library Service response - user does not own the game (404)
      const notFoundError = {
        response: { status: 404 },
        message: 'Not found',
      };

      mockHttpService.get.mockReturnValue(throwError(() => notFoundError));
      mockCacheManager.get.mockResolvedValue(undefined);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await ownershipService.checkGameOwnership(userId, gameId);

      expect(result).toBe(false);
    });

    it('should cache ownership verification results to reduce Library Service load', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';

      // First call - cache miss, call Library Service
      mockCacheManager.get.mockResolvedValueOnce(undefined);
      const ownershipResponse: AxiosResponse = {
        data: { owned: true, gameId, userId },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(ownershipResponse));
      mockCacheManager.set.mockResolvedValue(undefined);

      const result1 = await ownershipService.checkGameOwnership(userId, gameId);
      expect(result1).toBe(true);
      expect(mockHttpService.get).toHaveBeenCalledTimes(1);

      // Second call - cache hit, no Library Service call
      mockCacheManager.get.mockResolvedValueOnce(true);
      const result2 = await ownershipService.checkGameOwnership(userId, gameId);
      expect(result2).toBe(true);
      expect(mockHttpService.get).toHaveBeenCalledTimes(1); // Still only 1 call
    });
  });

  describe('Achievement Service Integration - First Review Webhook', () => {
    it('should notify Achievement Service when user creates their first review', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';
      const reviewId = 'review-789';

      // Mock Achievement Service - this is user's first review
      const firstReviewCheckResponse: AxiosResponse = {
        data: { isFirstReview: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(firstReviewCheckResponse));

      const isFirstReview = await achievementService.checkUserFirstReview(userId);
      expect(isFirstReview).toBe(true);

      // Mock Achievement Service notification response
      const notificationResponse: AxiosResponse = {
        data: { success: true, achievementId: 'achievement-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValue(of(notificationResponse));

      const notificationResult = await achievementService.notifyFirstReview(userId, gameId, reviewId);
      expect(notificationResult).toBe(true);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://achievement-service:3000/achievements/review',
        expect.objectContaining({
          userId,
          gameId,
          reviewId,
          achievementType: 'FIRST_REVIEW',
          timestamp: expect.any(String),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          }),
        })
      );
    });

    it('should not notify Achievement Service for subsequent reviews', async () => {
      const userId = 'user-123';

      // Mock Achievement Service - this is NOT user's first review
      const firstReviewCheckResponse: AxiosResponse = {
        data: { isFirstReview: false },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(firstReviewCheckResponse));

      const isFirstReview = await achievementService.checkUserFirstReview(userId);
      expect(isFirstReview).toBe(false);

      // Achievement notification should not be called for non-first reviews
      expect(mockHttpService.post).not.toHaveBeenCalled();
    });

    it('should handle Achievement Service failures gracefully without blocking review creation', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';
      const reviewId = 'review-789';

      // Mock Achievement Service failure
      mockHttpService.post.mockReturnValue(throwError(() => new Error('Achievement Service unavailable')));

      const result = await achievementService.notifyFirstReview(userId, gameId, reviewId);
      expect(result).toBe(false); // Should return false but not throw error
    });
  });

  describe('Notification Service Integration - New Review Notifications', () => {
    it('should notify Notification Service about new reviews', async () => {
      const review: Review = {
        id: 'review-123',
        userId: 'user-456',
        gameId: 'game-789',
        text: 'Great game! Really enjoyed it.',
        rating: 5,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z'),
      };

      const gameName = 'Test Game';
      const userName = 'Test User';

      // Mock Notification Service response
      const notificationResponse: AxiosResponse = {
        data: { success: true, notificationId: 'notification-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValue(of(notificationResponse));

      const result = await notificationService.notifyNewReview(review, gameName, userName);
      expect(result).toBe(true);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://notification-service:3000/notifications/review',
        expect.objectContaining({
          type: 'NEW_REVIEW',
          userId: review.userId,
          gameId: review.gameId,
          reviewId: review.id,
          rating: review.rating,
          reviewText: review.text,
          timestamp: review.createdAt.toISOString(),
          metadata: {
            gameName,
            userName,
          },
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          }),
        })
      );
    });

    it('should notify Notification Service about review updates', async () => {
      const review: Review = {
        id: 'review-123',
        userId: 'user-456',
        gameId: 'game-789',
        text: 'Updated review text',
        rating: 4,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-02T00:00:00Z'),
      };

      // Mock Notification Service response
      const notificationResponse: AxiosResponse = {
        data: { success: true, notificationId: 'notification-456' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValue(of(notificationResponse));

      const result = await notificationService.notifyReviewUpdate(review);
      expect(result).toBe(true);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://notification-service:3000/notifications/review-update',
        expect.objectContaining({
          type: 'REVIEW_UPDATED',
          userId: review.userId,
          gameId: review.gameId,
          reviewId: review.id,
          rating: review.rating,
          reviewText: review.text,
          timestamp: review.updatedAt.toISOString(),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          }),
        })
      );
    });

    it('should handle Notification Service failures gracefully', async () => {
      const review: Review = {
        id: 'review-123',
        userId: 'user-456',
        gameId: 'game-789',
        text: 'Great game!',
        rating: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock Notification Service failure
      mockHttpService.post.mockReturnValue(throwError(() => new Error('Notification Service unavailable')));

      const result = await notificationService.notifyNewReview(review);
      expect(result).toBe(false); // Should return false but not throw error
    });
  });

  describe('Game Catalog Service Integration - Rating Updates and Game Info', () => {
    it('should update Game Catalog Service when game ratings change', async () => {
      const gameRating: GameRating = {
        gameId: 'game-123',
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date('2023-01-01T00:00:00Z'),
      };

      // Mock Game Catalog Service response
      const catalogResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.put.mockReturnValue(of(catalogResponse));

      const result = await gameCatalogService.updateGameRating(gameRating);
      expect(result).toBe(true);

      expect(mockHttpService.put).toHaveBeenCalledWith(
        `http://game-catalog-service:3000/games/${gameRating.gameId}/rating`,
        expect.objectContaining({
          gameId: gameRating.gameId,
          averageRating: gameRating.averageRating,
          totalReviews: gameRating.totalReviews,
          timestamp: gameRating.updatedAt.toISOString(),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          }),
        })
      );
    });

    it('should fetch game information from Game Catalog Service', async () => {
      const gameId = 'game-123';

      // Mock Game Catalog Service response
      const gameInfoResponse: AxiosResponse = {
        data: { id: gameId, name: 'Test Game', description: 'A test game' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(gameInfoResponse));

      const result = await gameCatalogService.getGameInfo(gameId);
      expect(result).toEqual({
        name: 'Test Game',
        exists: true,
      });

      expect(mockHttpService.get).toHaveBeenCalledWith(
        `http://game-catalog-service:3000/games/${gameId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          }),
        })
      );
    });

    it('should handle Game Catalog Service failures gracefully', async () => {
      const gameRating: GameRating = {
        gameId: 'game-123',
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date(),
      };

      // Mock Game Catalog Service failure
      mockHttpService.put.mockReturnValue(throwError(() => new Error('Game Catalog Service unavailable')));

      const result = await gameCatalogService.updateGameRating(gameRating);
      expect(result).toBe(false); // Should return false but not throw error
    });
  });

  describe('External API for Game Catalog Service - Rating Access', () => {
    it('should provide game rating API endpoint for Game Catalog Service', async () => {
      const gameId = 'game-123';
      const gameRating: GameRating = {
        gameId,
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date('2023-01-01T00:00:00Z'),
      };

      mockGameRatingRepository.findOne.mockResolvedValue(gameRating);

      const result = await externalController.getGameRating(gameId);

      expect(result).toEqual({
        gameId: gameRating.gameId,
        averageRating: gameRating.averageRating,
        totalReviews: gameRating.totalReviews,
        updatedAt: gameRating.updatedAt,
      });

      expect(mockGameRatingRepository.findOne).toHaveBeenCalledWith({
        where: { gameId },
      });
    });

    it('should provide game rating summary API endpoint for Game Catalog Service', async () => {
      const gameId = 'game-123';
      const gameRating: GameRating = {
        gameId,
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date(),
      };

      mockGameRatingRepository.findOne.mockResolvedValue(gameRating);

      const result = await externalController.getGameRatingSummary(gameId);

      expect(result).toEqual({
        rating: 4.25,
        reviewCount: 42,
        hasRating: true,
      });
    });

    it('should provide batch game ratings API endpoint for Game Catalog Service', async () => {
      const gameIds = 'game-123,game-456,game-789';
      const gameRatings = [
        {
          gameId: 'game-123',
          averageRating: 4.25,
          totalReviews: 42,
          updatedAt: new Date(),
        },
        {
          gameId: 'game-456',
          averageRating: 3.75,
          totalReviews: 20,
          updatedAt: new Date(),
        },
        null, // game-789 has no rating
      ];

      mockGameRatingRepository.findOne
        .mockResolvedValueOnce(gameRatings[0])
        .mockResolvedValueOnce(gameRatings[1])
        .mockResolvedValueOnce(gameRatings[2]);

      const result = await externalController.getBatchGameRatings(gameIds);

      expect(result).toEqual({
        ratings: {
          'game-123': { rating: 4.25, reviewCount: 42, hasRating: true },
          'game-456': { rating: 3.75, reviewCount: 20, hasRating: true },
          'game-789': { rating: 0, reviewCount: 0, hasRating: false },
        },
      });
    });

    it('should return default values for games with no ratings', async () => {
      const gameId = 'game-no-rating';

      mockGameRatingRepository.findOne.mockResolvedValue(null);

      const result = await externalController.getGameRatingSummary(gameId);

      expect(result).toEqual({
        rating: 0,
        reviewCount: 0,
        hasRating: false,
      });
    });
  });

  describe('End-to-End MVP Integration Flow', () => {
    it('should complete full review creation with all MVP service integrations', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';
      const createReviewDto: CreateReviewDto = {
        gameId,
        text: 'Amazing game! Highly recommend it.',
        rating: 5,
      };

      // Setup all service mocks for successful flow
      
      // 1. Library Service - ownership verification
      const ownershipResponse: AxiosResponse = {
        data: { owned: true, gameId, userId },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(ownershipResponse));

      // 2. Achievement Service - first review check
      const firstReviewCheckResponse: AxiosResponse = {
        data: { isFirstReview: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(firstReviewCheckResponse));

      // 3. Game Catalog Service - game info
      const gameInfoResponse: AxiosResponse = {
        data: { id: gameId, name: 'Test Game', description: 'A test game' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(gameInfoResponse));

      // 4. Achievement Service - first review notification
      const achievementNotificationResponse: AxiosResponse = {
        data: { success: true, achievementId: 'achievement-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValueOnce(of(achievementNotificationResponse));

      // 5. Notification Service - new review notification
      const notificationResponse: AxiosResponse = {
        data: { success: true, notificationId: 'notification-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValueOnce(of(notificationResponse));

      // 6. Game Catalog Service - rating update
      const catalogUpdateResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.put.mockReturnValueOnce(of(catalogUpdateResponse));

      // Setup database mocks
      mockReviewRepository.findOne.mockResolvedValue(null); // No existing review
      const savedReview: Review = {
        id: 'review-789',
        userId,
        gameId,
        text: createReviewDto.text,
        rating: createReviewDto.rating,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockReviewRepository.create.mockReturnValue(savedReview);
      mockReviewRepository.save.mockResolvedValue(savedReview);

      // Setup rating calculation mocks
      const gameRating: GameRating = {
        gameId,
        averageRating: 4.5,
        totalReviews: 10,
        updatedAt: new Date(),
      };
      mockGameRatingRepository.findOne.mockResolvedValue(gameRating);
      mockGameRatingRepository.save.mockResolvedValue(gameRating);
      mockGameRatingRepository.createQueryBuilder().getRawOne.mockResolvedValue({
        averageRating: 4.5,
        totalReviews: 10,
      });

      // Setup cache mocks
      mockCacheManager.get.mockResolvedValue(undefined);
      mockCacheManager.set.mockResolvedValue(undefined);

      // Execute the review creation
      const result = await reviewService.createReview(userId, createReviewDto);

      // Verify the review was created
      expect(result).toEqual(savedReview);

      // Allow time for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all MVP service integrations were called
      expect(mockHttpService.get).toHaveBeenCalledTimes(3); // Library, Achievement check, Game Catalog
      expect(mockHttpService.post).toHaveBeenCalledTimes(2); // Achievement notification, Notification
      expect(mockHttpService.put).toHaveBeenCalledTimes(1); // Game Catalog rating update
    });

    it('should handle partial MVP service failures gracefully', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';
      const createReviewDto: CreateReviewDto = {
        gameId,
        text: 'Great game!',
        rating: 4,
      };

      // Library Service works (required for review creation)
      const ownershipResponse: AxiosResponse = {
        data: { owned: true, gameId, userId },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(ownershipResponse));

      // Achievement Service works for check
      const firstReviewCheckResponse: AxiosResponse = {
        data: { isFirstReview: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(firstReviewCheckResponse));

      // Game Catalog Service fails
      mockHttpService.get.mockReturnValueOnce(throwError(() => new Error('Service unavailable')));

      // Achievement notification fails
      mockHttpService.post.mockReturnValueOnce(throwError(() => new Error('Service unavailable')));

      // Notification Service fails
      mockHttpService.post.mockReturnValueOnce(throwError(() => new Error('Service unavailable')));

      // Game Catalog rating update fails
      mockHttpService.put.mockReturnValueOnce(throwError(() => new Error('Service unavailable')));

      // Setup database mocks
      mockReviewRepository.findOne.mockResolvedValue(null);
      const savedReview: Review = {
        id: 'review-789',
        userId,
        gameId,
        text: createReviewDto.text,
        rating: createReviewDto.rating,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockReviewRepository.create.mockReturnValue(savedReview);
      mockReviewRepository.save.mockResolvedValue(savedReview);

      // Setup rating calculation mocks
      const gameRating: GameRating = {
        gameId,
        averageRating: 4.0,
        totalReviews: 5,
        updatedAt: new Date(),
      };
      mockGameRatingRepository.findOne.mockResolvedValue(gameRating);
      mockGameRatingRepository.save.mockResolvedValue(gameRating);
      mockGameRatingRepository.createQueryBuilder().getRawOne.mockResolvedValue({
        averageRating: 4.0,
        totalReviews: 5,
      });

      // Setup cache mocks
      mockCacheManager.get.mockResolvedValue(undefined);
      mockCacheManager.set.mockResolvedValue(undefined);

      // Execute the review creation - should succeed despite service failures
      const result = await reviewService.createReview(userId, createReviewDto);

      // Verify the review was still created successfully
      expect(result).toEqual(savedReview);
      expect(mockReviewRepository.save).toHaveBeenCalledWith(savedReview);
    });
  });
});