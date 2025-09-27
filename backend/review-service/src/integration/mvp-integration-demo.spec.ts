import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

import { AchievementService } from '../services/achievement.service';
import { NotificationService } from '../services/notification.service';
import { GameCatalogService } from '../services/game-catalog.service';
import { OwnershipService } from '../services/ownership.service';
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

/**
 * MVP Services Integration Demo Tests
 * 
 * This test suite demonstrates that all MVP service integrations from task 10 are implemented:
 * 1. Achievement Service webhook for first review creation
 * 2. Notification Service integration for new review notifications
 * 3. Game Catalog Service API for rating access and updates
 * 4. Library Service integration for game ownership verification
 */
describe('MVP Services Integration Demo', () => {
  let achievementService: AchievementService;
  let notificationService: NotificationService;
  let gameCatalogService: GameCatalogService;
  let ownershipService: OwnershipService;

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

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementService,
        NotificationService,
        GameCatalogService,
        OwnershipService,
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
      ],
    }).compile();

    achievementService = module.get<AchievementService>(AchievementService);
    notificationService = module.get<NotificationService>(NotificationService);
    gameCatalogService = module.get<GameCatalogService>(GameCatalogService);
    ownershipService = module.get<OwnershipService>(OwnershipService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Task 10.1: Achievement Service Webhook Integration', () => {
    it('should successfully notify Achievement Service about first review creation', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';
      const reviewId = 'review-789';

      // Mock successful Achievement Service response
      const mockResponse: AxiosResponse = {
        data: { success: true, achievementId: 'achievement-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await achievementService.notifyFirstReview(userId, gameId, reviewId);

      expect(result).toBe(true);
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

    it('should check if user has created their first review', async () => {
      const userId = 'user-123';

      // Mock Achievement Service response for first review check
      const mockResponse: AxiosResponse = {
        data: { isFirstReview: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await achievementService.checkUserFirstReview(userId);

      expect(result).toBe(true);
      expect(mockHttpService.get).toHaveBeenCalledWith(
        `http://achievement-service:3000/achievements/user/${userId}/first-review-status`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          }),
        })
      );
    });
  });

  describe('Task 10.2: Notification Service Integration', () => {
    it('should successfully notify Notification Service about new reviews', async () => {
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

      // Mock successful Notification Service response
      const mockResponse: AxiosResponse = {
        data: { success: true, notificationId: 'notification-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

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

      // Mock successful Notification Service response
      const mockResponse: AxiosResponse = {
        data: { success: true, notificationId: 'notification-456' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

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
  });

  describe('Task 10.3: Game Catalog Service Integration', () => {
    it('should update Game Catalog Service when game ratings change', async () => {
      const gameRating: GameRating = {
        gameId: 'game-123',
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date('2023-01-01T00:00:00Z'),
      };

      // Mock successful Game Catalog Service response
      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.put.mockReturnValue(of(mockResponse));

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

      // Mock successful Game Catalog Service response
      const mockResponse: AxiosResponse = {
        data: { id: gameId, name: 'Test Game', description: 'A test game' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

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
  });

  describe('Task 10.4: Library Service Integration', () => {
    it('should verify game ownership through Library Service', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';

      // Mock successful Library Service response
      const mockResponse: AxiosResponse = {
        data: { owned: true, gameId, userId, purchaseDate: '2023-01-01T00:00:00Z' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));
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

    it('should cache ownership verification results', async () => {
      const userId = 'user-123';
      const gameId = 'game-456';

      // First call - cache miss
      mockCacheManager.get.mockResolvedValueOnce(undefined);
      const mockResponse: AxiosResponse = {
        data: { owned: true, gameId, userId },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));
      mockCacheManager.set.mockResolvedValue(undefined);

      const result1 = await ownershipService.checkGameOwnership(userId, gameId);
      expect(result1).toBe(true);
      expect(mockHttpService.get).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      mockCacheManager.get.mockResolvedValueOnce(true);
      const result2 = await ownershipService.checkGameOwnership(userId, gameId);
      expect(result2).toBe(true);
      expect(mockHttpService.get).toHaveBeenCalledTimes(1); // Still only 1 call
    });
  });

  describe('Task 10.5: Service Health Monitoring', () => {
    it('should monitor health of all MVP services', async () => {
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

      expect(ownershipHealth.status).toBe('healthy');
      expect(achievementHealth.status).toBe('healthy');
      expect(notificationHealth.status).toBe('healthy');
      expect(gameCatalogHealth.status).toBe('healthy');
    });

    it('should handle service failures gracefully', async () => {
      // Mock Achievement Service failure
      mockHttpService.post.mockReturnValue(throwError(() => new Error('Achievement Service unavailable')));

      const result = await achievementService.notifyFirstReview('user-123', 'game-456', 'review-789');
      expect(result).toBe(false); // Should return false but not throw error

      // Mock Notification Service failure
      mockHttpService.post.mockReturnValue(throwError(() => new Error('Notification Service unavailable')));

      const review: Review = {
        id: 'review-123',
        userId: 'user-456',
        gameId: 'game-789',
        text: 'Great game!',
        rating: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const notificationResult = await notificationService.notifyNewReview(review);
      expect(notificationResult).toBe(false); // Should return false but not throw error

      // Mock Game Catalog Service failure
      const gameRating: GameRating = {
        gameId: 'game-123',
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date(),
      };

      mockHttpService.put.mockReturnValue(throwError(() => new Error('Game Catalog Service unavailable')));

      const catalogResult = await gameCatalogService.updateGameRating(gameRating);
      expect(catalogResult).toBe(false); // Should return false but not throw error
    });
  });

  describe('Task 10 Summary: All MVP Integrations Working', () => {
    it('should demonstrate all MVP service integrations are implemented and functional', async () => {
      // This test verifies that all the required integrations from task 10 are working:

      // 1. Achievement Service webhook for first review creation ✓
      const achievementResponse: AxiosResponse = {
        data: { success: true, achievementId: 'achievement-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValueOnce(of(achievementResponse));

      const achievementResult = await achievementService.notifyFirstReview('user-123', 'game-456', 'review-789');
      expect(achievementResult).toBe(true);

      // 2. Notification Service integration for new review notifications ✓
      const notificationResponse: AxiosResponse = {
        data: { success: true, notificationId: 'notification-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValueOnce(of(notificationResponse));

      const review: Review = {
        id: 'review-123',
        userId: 'user-456',
        gameId: 'game-789',
        text: 'Great game!',
        rating: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const notificationResult = await notificationService.notifyNewReview(review);
      expect(notificationResult).toBe(true);

      // 3. Game Catalog Service API for rating updates ✓
      const catalogResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.put.mockReturnValueOnce(of(catalogResponse));

      const gameRating: GameRating = {
        gameId: 'game-123',
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date(),
      };

      const catalogResult = await gameCatalogService.updateGameRating(gameRating);
      expect(catalogResult).toBe(true);

      // 4. Library Service integration for game ownership verification ✓
      const ownershipResponse: AxiosResponse = {
        data: { owned: true, gameId: 'game-456', userId: 'user-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValueOnce(of(ownershipResponse));
      mockCacheManager.get.mockResolvedValue(undefined);
      mockCacheManager.set.mockResolvedValue(undefined);

      const ownershipResult = await ownershipService.checkGameOwnership('user-123', 'game-456');
      expect(ownershipResult).toBe(true);

      // All integrations are working! ✓
      expect(achievementResult && notificationResult && catalogResult && ownershipResult).toBe(true);
    });
  });
});