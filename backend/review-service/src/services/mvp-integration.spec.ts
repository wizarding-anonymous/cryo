import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

import { ReviewService } from './review.service';
import { RatingService } from './rating.service';
import { OwnershipService } from './ownership.service';
import { AchievementService } from './achievement.service';
import { NotificationService } from './notification.service';
import { GameCatalogService } from './game-catalog.service';
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';
import { CreateReviewDto } from '../dto';
import { MetricsService } from './metrics.service';

describe('MVP Integration Tests', () => {
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
  };

  const mockGameRatingRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
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

  describe('Complete Review Creation Flow with MVP Services', () => {
    it('should complete full review creation cycle with all MVP integrations', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';
      const createReviewDto: CreateReviewDto = {
        gameId,
        text: 'Great game! Really enjoyed it.',
        rating: 5,
      };

      // Mock Library Service - user owns the game
      const ownershipResponse: AxiosResponse = {
        data: { owned: true, gameId, userId },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(ownershipResponse));

      // Mock Achievement Service - this is user's first review
      const firstReviewCheckResponse: AxiosResponse = {
        data: { isFirstReview: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(firstReviewCheckResponse));

      // Mock Game Catalog Service - get game info
      const gameInfoResponse: AxiosResponse = {
        data: { id: gameId, name: 'Test Game', description: 'A test game' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(gameInfoResponse));

      // Mock Achievement Service - notify first review
      const achievementNotificationResponse: AxiosResponse = {
        data: { success: true, achievementId: 'achievement-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValueOnce(of(achievementNotificationResponse));

      // Mock Notification Service - notify new review
      const notificationResponse: AxiosResponse = {
        data: { success: true, notificationId: 'notification-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValueOnce(of(notificationResponse));

      // Mock Game Catalog Service - update rating
      const catalogUpdateResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.put.mockReturnValueOnce(of(catalogUpdateResponse));

      // Mock database operations
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

      // Mock cache operations
      mockCacheManager.get.mockResolvedValue(undefined);
      mockCacheManager.set.mockResolvedValue(undefined);

      // Execute the review creation
      const result = await reviewService.createReview(userId, createReviewDto);

      // Verify the result
      expect(result).toEqual(savedReview);

      // Verify Library Service integration (ownership check)
      expect(mockHttpService.get).toHaveBeenCalledWith(
        `http://library-service:3000/library/user/${userId}/game/${gameId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          }),
        })
      );

      // Verify Achievement Service integration (first review check)
      expect(mockHttpService.get).toHaveBeenCalledWith(
        `http://achievement-service:3000/achievements/user/${userId}/first-review-status`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          }),
        })
      );

      // Verify Game Catalog Service integration (game info)
      expect(mockHttpService.get).toHaveBeenCalledWith(
        `http://game-catalog-service:3000/games/${gameId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          }),
        })
      );

      // Allow some time for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify Achievement Service notification (first review)
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://achievement-service:3000/achievements/review',
        expect.objectContaining({
          userId,
          gameId,
          reviewId: savedReview.id,
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

      // Verify Notification Service integration (new review)
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://notification-service:3000/notifications/review',
        expect.objectContaining({
          type: 'NEW_REVIEW',
          userId,
          gameId,
          reviewId: savedReview.id,
          rating: createReviewDto.rating,
          reviewText: createReviewDto.text,
          timestamp: expect.any(String),
          metadata: expect.objectContaining({
            gameName: 'Test Game',
          }),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          }),
        })
      );

      // Verify Game Catalog Service integration (rating update)
      expect(mockHttpService.put).toHaveBeenCalledWith(
        `http://game-catalog-service:3000/games/${gameId}/rating`,
        expect.objectContaining({
          gameId,
          averageRating: gameRating.averageRating,
          totalReviews: gameRating.totalReviews,
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

    it('should handle external service failures gracefully', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';
      const createReviewDto: CreateReviewDto = {
        gameId,
        text: 'Great game!',
        rating: 5,
      };

      // Mock Library Service - user owns the game
      const ownershipResponse: AxiosResponse = {
        data: { owned: true, gameId, userId },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(ownershipResponse));

      // Mock Achievement Service - this is user's first review
      const firstReviewCheckResponse: AxiosResponse = {
        data: { isFirstReview: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(firstReviewCheckResponse));

      // Mock Game Catalog Service - service unavailable
      mockHttpService.get.mockReturnValueOnce(throwError(() => new Error('Service unavailable')));

      // Mock Achievement Service - service unavailable
      mockHttpService.post.mockReturnValueOnce(throwError(() => new Error('Service unavailable')));

      // Mock Notification Service - service unavailable
      mockHttpService.post.mockReturnValueOnce(throwError(() => new Error('Service unavailable')));

      // Mock Game Catalog Service - service unavailable
      mockHttpService.put.mockReturnValueOnce(throwError(() => new Error('Service unavailable')));

      // Mock database operations
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

      // Mock cache operations
      mockCacheManager.get.mockResolvedValue(undefined);
      mockCacheManager.set.mockResolvedValue(undefined);

      // Execute the review creation - should succeed despite external service failures
      const result = await reviewService.createReview(userId, createReviewDto);

      // Verify the review was still created successfully
      expect(result).toEqual(savedReview);
      expect(mockReviewRepository.save).toHaveBeenCalledWith(savedReview);
    });
  });

  describe('Service Health Checks', () => {
    it('should check health of all MVP services', async () => {
      // Mock all services as healthy
      const healthyResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get
        .mockReturnValueOnce(of(healthyResponse)) // Library Service
        .mockReturnValueOnce(of(healthyResponse)) // Achievement Service
        .mockReturnValueOnce(of(healthyResponse)) // Notification Service
        .mockReturnValueOnce(of(healthyResponse)); // Game Catalog Service

      const [
        ownershipHealth,
        achievementHealth,
        notificationHealth,
        gameCatalogHealth,
      ] = await Promise.all([
        ownershipService.getServiceHealth(),
        achievementService.getServiceHealth(),
        notificationService.getServiceHealth(),
        gameCatalogService.getServiceHealth(),
      ]);

      expect(ownershipHealth).toEqual({
        status: 'healthy',
        libraryService: true,
      });

      expect(achievementHealth).toEqual({
        status: 'healthy',
        achievementService: true,
      });

      expect(notificationHealth).toEqual({
        status: 'healthy',
        notificationService: true,
      });

      expect(gameCatalogHealth).toEqual({
        status: 'healthy',
        gameCatalogService: true,
      });
    });

    it('should detect unhealthy MVP services', async () => {
      // Mock all services as unhealthy
      mockHttpService.get
        .mockReturnValueOnce(throwError(() => new Error('Service unavailable'))) // Library Service
        .mockReturnValueOnce(throwError(() => new Error('Service unavailable'))) // Achievement Service
        .mockReturnValueOnce(throwError(() => new Error('Service unavailable'))) // Notification Service
        .mockReturnValueOnce(throwError(() => new Error('Service unavailable'))); // Game Catalog Service

      const [
        ownershipHealth,
        achievementHealth,
        notificationHealth,
        gameCatalogHealth,
      ] = await Promise.all([
        ownershipService.getServiceHealth(),
        achievementService.getServiceHealth(),
        notificationService.getServiceHealth(),
        gameCatalogService.getServiceHealth(),
      ]);

      expect(ownershipHealth).toEqual({
        status: 'unhealthy',
        libraryService: false,
      });

      expect(achievementHealth).toEqual({
        status: 'unhealthy',
        achievementService: false,
      });

      expect(notificationHealth).toEqual({
        status: 'unhealthy',
        notificationService: false,
      });

      expect(gameCatalogHealth).toEqual({
        status: 'unhealthy',
        gameCatalogService: false,
      });
    });
  });

  describe('External API for Game Catalog Service', () => {
    it('should provide game rating data to Game Catalog Service', async () => {
      const gameId = 'game-123';
      const gameRating: GameRating = {
        gameId,
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date(),
      };

      mockGameRatingRepository.findOne.mockResolvedValue(gameRating);

      const result = await ratingService.getGameRating(gameId);

      expect(result).toEqual(gameRating);
      expect(mockGameRatingRepository.findOne).toHaveBeenCalledWith({
        where: { gameId },
      });
    });

    it('should handle batch rating requests from Game Catalog Service', async () => {
      const gameIds = ['game-123', 'game-456', 'game-789'];
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

      const results = await Promise.all(
        gameIds.map(gameId => ratingService.getGameRating(gameId))
      );

      expect(results).toEqual(gameRatings);
    });
  });
});