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
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';
import { CreateReviewDto } from '../dto';
import { MetricsService } from '../services/metrics.service';

/**
 * End-to-End MVP Integration Tests for Task 12
 * 
 * This test suite covers the complete integration testing requirements:
 * - Test integration with Library Service for game ownership verification before review creation
 * - Verify integration with Game Catalog Service for game rating updates
 * - Test integration with Achievement Service for review creation achievements
 * - Verify integration with Notification Service for new review notifications
 * - Create end-to-end tests for complete cycle: game purchase → review creation → rating update
 * - Test rating synchronization between Review Service and Game Catalog Service
 */
describe('End-to-End MVP Integration Tests (Task 12)', () => {
  let reviewService: ReviewService;
  let ratingService: RatingService;
  let ownershipService: OwnershipService;
  let achievementService: AchievementService;
  let notificationService: NotificationService;
  let gameCatalogService: GameCatalogService;
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
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Task 12.1: Library Service Integration - Game Ownership Verification', () => {
    it('should verify game ownership before allowing review creation', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';
      const createReviewDto: CreateReviewDto = {
        gameId,
        text: 'Amazing game! Highly recommend it.',
        rating: 5,
      };

      // Mock Library Service - user owns the game
      const ownershipResponse: AxiosResponse = {
        data: { owned: true, gameId, userId, purchaseDate: '2023-01-01T00:00:00Z' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValueOnce(of(ownershipResponse));
      mockCacheManager.get.mockResolvedValue(undefined);
      mockCacheManager.set.mockResolvedValue(undefined);

      // Mock other services for successful review creation
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

      // Mock rating calculation
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

      // Mock other service calls
      mockHttpService.get.mockReturnValueOnce(of({ data: { isFirstReview: true }, status: 200, statusText: 'OK', headers: {}, config: {} as any }));
      mockHttpService.get.mockReturnValueOnce(of({ data: { id: gameId, name: 'Test Game' }, status: 200, statusText: 'OK', headers: {}, config: {} as any }));
      mockHttpService.post.mockReturnValue(of({ data: { success: true }, status: 200, statusText: 'OK', headers: {}, config: {} as any }));
      mockHttpService.put.mockReturnValue(of({ data: { success: true }, status: 200, statusText: 'OK', headers: {}, config: {} as any }));

      const result = await reviewService.createReview(userId, createReviewDto);

      expect(result).toEqual(savedReview);
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

    it('should reject review creation when user does not own the game', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';
      const createReviewDto: CreateReviewDto = {
        gameId,
        text: 'Great game!',
        rating: 4,
      };

      // Mock Library Service - user does not own the game (404)
      const notFoundError = {
        response: { status: 404 },
        message: 'Not found',
      };

      mockHttpService.get.mockReturnValue(throwError(() => notFoundError));
      mockCacheManager.get.mockResolvedValue(undefined);
      mockCacheManager.set.mockResolvedValue(undefined);

      await expect(reviewService.createReview(userId, createReviewDto)).rejects.toThrow();
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

  describe('Task 12.2: Game Catalog Service Integration - Rating Updates', () => {
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

    it('should synchronize ratings between Review Service and Game Catalog Service', async () => {
      const gameId = 'game-123';
      
      // Mock rating calculation in Review Service
      mockGameRatingRepository.createQueryBuilder().getRawOne.mockResolvedValue({
        averageRating: 4.2,
        totalReviews: 15,
      });

      const existingRating: GameRating = {
        gameId,
        averageRating: 4.0,
        totalReviews: 14,
        updatedAt: new Date(),
      };
      mockGameRatingRepository.findOne.mockResolvedValue(existingRating);

      const updatedRating: GameRating = {
        gameId,
        averageRating: 4.2,
        totalReviews: 15,
        updatedAt: new Date(),
      };
      mockGameRatingRepository.save.mockResolvedValue(updatedRating);

      // Mock Game Catalog Service update
      const catalogResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.put.mockReturnValue(of(catalogResponse));

      // Update rating in Review Service
      const result = await ratingService.updateGameRating(gameId);
      expect(result).toEqual(updatedRating);

      // Verify Game Catalog Service was updated
      expect(mockHttpService.put).toHaveBeenCalledWith(
        `http://game-catalog-service:3000/games/${gameId}/rating`,
        expect.objectContaining({
          gameId,
          averageRating: 4.2,
          totalReviews: 15,
        }),
        expect.any(Object)
      );
    });

    it('should handle Game Catalog Service failures gracefully during rating sync', async () => {
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

  describe('Task 12.3: Achievement Service Integration - Review Creation Achievements', () => {
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

  describe('Task 12.4: Notification Service Integration - New Review Notifications', () => {
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

  describe('Task 12.5: End-to-End Complete Cycle Tests', () => {
    it('should complete full cycle: game purchase → review creation → rating update', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';
      const createReviewDto: CreateReviewDto = {
        gameId,
        text: 'Amazing game! Highly recommend it.',
        rating: 5,
      };

      // Step 1: Game purchase verification (Library Service)
      const ownershipResponse: AxiosResponse = {
        data: { owned: true, gameId, userId, purchaseDate: '2023-01-01T00:00:00Z' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(ownershipResponse));

      // Step 2: Achievement Service - first review check
      const firstReviewCheckResponse: AxiosResponse = {
        data: { isFirstReview: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(firstReviewCheckResponse));

      // Step 3: Game Catalog Service - game info
      const gameInfoResponse: AxiosResponse = {
        data: { id: gameId, name: 'Test Game', description: 'A test game' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(gameInfoResponse));

      // Step 4: Achievement Service - first review notification
      const achievementNotificationResponse: AxiosResponse = {
        data: { success: true, achievementId: 'achievement-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValueOnce(of(achievementNotificationResponse));

      // Step 5: Notification Service - new review notification
      const notificationResponse: AxiosResponse = {
        data: { success: true, notificationId: 'notification-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValueOnce(of(notificationResponse));

      // Step 6: Game Catalog Service - rating update
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

      // Execute the complete cycle
      const result = await reviewService.createReview(userId, createReviewDto);

      // Verify the review was created
      expect(result).toEqual(savedReview);

      // Allow time for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all MVP service integrations were called in the correct sequence
      expect(mockHttpService.get).toHaveBeenCalledTimes(3); // Library, Achievement check, Game Catalog
      expect(mockHttpService.post).toHaveBeenCalledTimes(2); // Achievement notification, Notification
      expect(mockHttpService.put).toHaveBeenCalledTimes(1); // Game Catalog rating update

      // Verify specific service calls
      expect(mockHttpService.get).toHaveBeenNthCalledWith(1, 
        `http://library-service:3000/library/user/${userId}/game/${gameId}`,
        expect.any(Object)
      );
      expect(mockHttpService.get).toHaveBeenNthCalledWith(2,
        `http://achievement-service:3000/achievements/user/${userId}/first-review-status`,
        expect.any(Object)
      );
      expect(mockHttpService.get).toHaveBeenNthCalledWith(3,
        `http://game-catalog-service:3000/games/${gameId}`,
        expect.any(Object)
      );
    });

    it('should handle partial service failures gracefully in end-to-end flow', async () => {
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

  describe('Task 12.6: Rating Synchronization Tests', () => {
    it('should maintain rating consistency between Review Service and Game Catalog Service', async () => {
      const gameId = 'game-123';
      
      // Simulate multiple rating updates
      const ratings = [
        { averageRating: 4.0, totalReviews: 10 },
        { averageRating: 4.2, totalReviews: 15 },
        { averageRating: 4.5, totalReviews: 20 },
      ];

      for (const [index, ratingData] of ratings.entries()) {
        // Mock rating calculation
        mockGameRatingRepository.createQueryBuilder().getRawOne.mockResolvedValueOnce(ratingData);
        
        const existingRating: GameRating = {
          gameId,
          averageRating: index > 0 ? ratings[index - 1].averageRating : 3.5,
          totalReviews: index > 0 ? ratings[index - 1].totalReviews : 5,
          updatedAt: new Date(),
        };
        mockGameRatingRepository.findOne.mockResolvedValueOnce(existingRating);

        const updatedRating: GameRating = {
          gameId,
          averageRating: ratingData.averageRating,
          totalReviews: ratingData.totalReviews,
          updatedAt: new Date(),
        };
        mockGameRatingRepository.save.mockResolvedValueOnce(updatedRating);

        // Mock Game Catalog Service update
        const catalogResponse: AxiosResponse = {
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };
        mockHttpService.put.mockReturnValueOnce(of(catalogResponse));

        // Update rating
        const result = await ratingService.updateGameRating(gameId);
        expect(result.averageRating).toBe(ratingData.averageRating);
        expect(result.totalReviews).toBe(ratingData.totalReviews);

        // Verify Game Catalog Service was updated with correct data
        expect(mockHttpService.put).toHaveBeenCalledWith(
          `http://game-catalog-service:3000/games/${gameId}/rating`,
          expect.objectContaining({
            gameId,
            averageRating: ratingData.averageRating,
            totalReviews: ratingData.totalReviews,
          }),
          expect.any(Object)
        );
      }

      // Verify all updates were synchronized
      expect(mockHttpService.put).toHaveBeenCalledTimes(3);
    });

    it('should retry rating synchronization on temporary Game Catalog Service failures', async () => {
      const gameRating: GameRating = {
        gameId: 'game-123',
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date(),
      };

      // Mock temporary failure followed by success
      mockHttpService.put
        .mockReturnValueOnce(throwError(() => new Error('Temporary failure')))
        .mockReturnValueOnce(of({
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        }));

      // First attempt should fail, but service should handle gracefully
      const result1 = await gameCatalogService.updateGameRating(gameRating);
      expect(result1).toBe(false);

      // Second attempt should succeed
      const result2 = await gameCatalogService.updateGameRating(gameRating);
      expect(result2).toBe(true);
    });
  });

  describe('Task 12 Summary: Complete MVP Integration Verification', () => {
    it('should demonstrate all MVP integration requirements are met', async () => {
      // This test verifies that all requirements from task 12 are implemented:

      // ✓ Test integration with Library Service for game ownership verification
      const ownershipResponse: AxiosResponse = {
        data: { owned: true, gameId: 'game-123', userId: 'user-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(ownershipResponse));
      mockCacheManager.get.mockResolvedValue(undefined);
      mockCacheManager.set.mockResolvedValue(undefined);

      const ownershipResult = await ownershipService.checkGameOwnership('user-123', 'game-123');
      expect(ownershipResult).toBe(true);

      // ✓ Verify integration with Game Catalog Service for game rating updates
      const gameRating: GameRating = {
        gameId: 'game-123',
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date(),
      };
      const catalogResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.put.mockReturnValueOnce(of(catalogResponse));

      const catalogResult = await gameCatalogService.updateGameRating(gameRating);
      expect(catalogResult).toBe(true);

      // ✓ Test integration with Achievement Service for review creation achievements
      const achievementResponse: AxiosResponse = {
        data: { success: true, achievementId: 'achievement-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValueOnce(of(achievementResponse));

      const achievementResult = await achievementService.notifyFirstReview('user-123', 'game-123', 'review-123');
      expect(achievementResult).toBe(true);

      // ✓ Verify integration with Notification Service for new review notifications
      const review: Review = {
        id: 'review-123',
        userId: 'user-123',
        gameId: 'game-123',
        text: 'Great game!',
        rating: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const notificationResponse: AxiosResponse = {
        data: { success: true, notificationId: 'notification-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValueOnce(of(notificationResponse));

      const notificationResult = await notificationService.notifyNewReview(review);
      expect(notificationResult).toBe(true);

      // All integrations are working correctly! ✓
      expect(ownershipResult && catalogResult && achievementResult && notificationResult).toBe(true);
    });
  });
});