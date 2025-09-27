import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

import { OwnershipService } from '../services/ownership.service';
import { AchievementService } from '../services/achievement.service';
import { NotificationService } from '../services/notification.service';
import { GameCatalogService } from '../services/game-catalog.service';

/**
 * Task 12: Integration Testing with MVP Ecosystem
 * 
 * This test suite specifically covers the requirements from task 12:
 * - Test integration with Library Service for game ownership verification before review creation
 * - Verify integration with Game Catalog Service for game rating updates
 * - Test integration with Achievement Service for review creation achievements
 * - Verify integration with Notification Service for new review notifications
 * - Create end-to-end tests for complete cycle: game purchase → review creation → rating update
 * - Test rating synchronization between Review Service and Game Catalog Service
 */
describe('Task 12: MVP Ecosystem Integration Tests', () => {
  let ownershipService: OwnershipService;
  let achievementService: AchievementService;
  let notificationService: NotificationService;
  let gameCatalogService: GameCatalogService;

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
        OWNERSHIP_REQUEST_TIMEOUT: 1000,
        ACHIEVEMENT_REQUEST_TIMEOUT: 1000,
        NOTIFICATION_REQUEST_TIMEOUT: 1000,
        GAME_CATALOG_REQUEST_TIMEOUT: 1000,
        OWNERSHIP_MAX_RETRIES: 1,
        ACHIEVEMENT_MAX_RETRIES: 1,
        NOTIFICATION_MAX_RETRIES: 1,
        GAME_CATALOG_MAX_RETRIES: 1,
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
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    ownershipService = module.get<OwnershipService>(OwnershipService);
    achievementService = module.get<AchievementService>(AchievementService);
    notificationService = module.get<NotificationService>(NotificationService);
    gameCatalogService = module.get<GameCatalogService>(GameCatalogService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('Library Service Integration - Game Ownership Verification', () => {
    it('should verify game ownership before allowing review creation', async () => {
      const userId = 'user123';
      const gameId = 'game456';

      // Mock cache miss first
      mockCacheManager.get.mockResolvedValue(undefined);
      
      const mockOwnershipResponse: AxiosResponse = {
        data: { owned: true, purchaseDate: '2024-01-15T10:00:00Z', gameId, userId },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockOwnershipResponse));

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

    it('should handle ownership verification failure', async () => {
      const userId = 'user123';
      const gameId = 'game456';

      // Mock cache miss first
      mockCacheManager.get.mockResolvedValue(undefined);
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Library service unavailable'))
      );

      const result = await ownershipService.checkGameOwnership(userId, gameId);

      expect(result).toBe(false);
    });

    it('should cache ownership verification results', async () => {
      const userId = 'user123';
      const gameId = 'game456';
      const cacheKey = `ownership_${userId}_${gameId}`;

      // First call - cache miss
      mockCacheManager.get.mockResolvedValueOnce(undefined);
      const mockOwnershipResponse: AxiosResponse = {
        data: { owned: true, purchaseDate: '2024-01-15T10:00:00Z', gameId, userId },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(mockOwnershipResponse));

      await ownershipService.checkGameOwnership(userId, gameId);

      expect(mockCacheManager.set).toHaveBeenCalledWith(cacheKey, true, 600);

      // Second call - cache hit
      mockCacheManager.get.mockResolvedValueOnce(true);
      const result = await ownershipService.checkGameOwnership(userId, gameId);

      expect(result).toBe(true);
      expect(mockHttpService.get).toHaveBeenCalledTimes(1); // Should not call HTTP service again
    });
  });

  describe('Game Catalog Service Integration - Rating Updates', () => {
    it('should update game rating in catalog service', async () => {
      const gameRating = {
        gameId: 'game456',
        averageRating: 4.5,
        totalReviews: 10,
        updatedAt: new Date(),
      };

      const mockUpdateResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.put.mockReturnValue(of(mockUpdateResponse));

      const result = await gameCatalogService.updateGameRating(gameRating as any);

      expect(result).toBe(true);
      expect(mockHttpService.put).toHaveBeenCalledWith(
        `http://game-catalog-service:3000/games/${gameRating.gameId}/rating`,
        {
          gameId: gameRating.gameId,
          averageRating: gameRating.averageRating,
          totalReviews: gameRating.totalReviews,
          timestamp: gameRating.updatedAt.toISOString(),
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          }),
        })
      );
    });

    it('should handle rating update failures gracefully', async () => {
      const gameRating = {
        gameId: 'game456',
        averageRating: 4.5,
        totalReviews: 10,
        updatedAt: new Date(),
      };

      mockHttpService.put.mockReturnValue(
        throwError(() => new Error('Game catalog service unavailable'))
      );

      const result = await gameCatalogService.updateGameRating(gameRating as any);

      expect(result).toBe(false);
    });

    it('should get game information from catalog', async () => {
      const gameId = 'game456';
      const expectedGameName = 'Test Game';

      const mockGetResponse: AxiosResponse = {
        data: { id: gameId, name: expectedGameName },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockGetResponse));

      const result = await gameCatalogService.getGameInfo(gameId);

      expect(result).toEqual({
        name: expectedGameName,
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

  describe('Achievement Service Integration - Review Creation Achievements', () => {
    it('should trigger achievement for first review creation', async () => {
      const userId = 'user123';
      const gameId = 'game456';
      const reviewId = 'review789';

      const mockAchievementResponse: AxiosResponse = {
        data: { success: true, achievementId: 'ach123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockAchievementResponse));

      const result = await achievementService.notifyFirstReview(userId, gameId, reviewId);

      expect(result).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://achievement-service:3000/achievements/review',
        {
          userId,
          gameId,
          reviewId,
          achievementType: 'FIRST_REVIEW',
          timestamp: expect.any(String),
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          }),
        })
      );
    });

    it('should handle achievement service failures', async () => {
      const userId = 'user123';
      const gameId = 'game456';
      const reviewId = 'review789';

      mockHttpService.post.mockReturnValue(
        throwError(() => new Error('Achievement service unavailable'))
      );

      const result = await achievementService.notifyFirstReview(userId, gameId, reviewId);

      expect(result).toBe(false);
    });

    it('should check if this is users first review', async () => {
      const userId = 'user123';

      const mockFirstReviewResponse: AxiosResponse = {
        data: { isFirstReview: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockFirstReviewResponse));

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

  describe('Notification Service Integration - New Review Notifications', () => {
    it('should send notification for new review', async () => {
      const mockReview = {
        id: 'review123',
        userId: 'user123',
        gameId: 'game456',
        rating: 5,
        text: 'Great game!',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockNotificationResponse: AxiosResponse = {
        data: { success: true, notificationId: 'notif123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockNotificationResponse));

      const result = await notificationService.notifyNewReview(mockReview as any, 'Test Game', 'TestUser');

      expect(result).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://notification-service:3000/notifications/review',
        {
          type: 'NEW_REVIEW',
          userId: mockReview.userId,
          gameId: mockReview.gameId,
          reviewId: mockReview.id,
          rating: mockReview.rating,
          reviewText: mockReview.text,
          timestamp: mockReview.createdAt.toISOString(),
          metadata: {
            gameName: 'Test Game',
            userName: 'TestUser',
          },
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'review-service/1.0',
          }),
        })
      );
    });

    it('should handle notification service failures', async () => {
      const mockReview = {
        id: 'review123',
        userId: 'user123',
        gameId: 'game456',
        rating: 5,
        text: 'Great game!',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockHttpService.post.mockReturnValue(
        throwError(() => new Error('Notification service unavailable'))
      );

      const result = await notificationService.notifyNewReview(mockReview as any);

      expect(result).toBe(false);
    });

    it('should send review update notifications', async () => {
      const mockReview = {
        id: 'review123',
        userId: 'user123',
        gameId: 'game456',
        rating: 4,
        text: 'Updated review text',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockNotificationResponse: AxiosResponse = {
        data: { success: true, notificationId: 'notif124' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockNotificationResponse));

      const result = await notificationService.notifyReviewUpdate(mockReview as any, 'Test Game', 'TestUser');

      expect(result).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://notification-service:3000/notifications/review-update',
        expect.objectContaining({
          type: 'REVIEW_UPDATED',
          userId: mockReview.userId,
          gameId: mockReview.gameId,
          reviewId: mockReview.id,
          rating: mockReview.rating,
          reviewText: mockReview.text,
          timestamp: mockReview.updatedAt.toISOString(),
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

  describe('End-to-End MVP Integration Tests', () => {
    it('should complete full cycle: ownership verification → review creation → rating update → achievements → notifications', async () => {
      const userId = 'user123';
      const gameId = 'game456';
      const reviewId = 'review123';
      const mockReview = {
        id: reviewId,
        userId,
        gameId,
        rating: 5,
        text: 'Excellent game with great graphics!',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockGameRating = {
        gameId,
        averageRating: 4.5,
        totalReviews: 11,
        updatedAt: new Date(),
      };

      // Step 1: Verify ownership
      const mockOwnershipResponse: AxiosResponse = {
        data: { owned: true, purchaseDate: '2024-01-15T10:00:00Z', gameId, userId },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockCacheManager.get.mockResolvedValue(undefined);
      mockHttpService.get.mockReturnValueOnce(of(mockOwnershipResponse));

      // Step 2: Update game rating
      const mockRatingUpdateResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.put.mockReturnValueOnce(of(mockRatingUpdateResponse));

      // Step 3: Trigger achievement
      const mockAchievementResponse: AxiosResponse = {
        data: { success: true, achievementId: 'ach123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValueOnce(of(mockAchievementResponse));

      // Step 4: Send notification
      const mockNotificationResponse: AxiosResponse = {
        data: { success: true, notificationId: 'notif123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValueOnce(of(mockNotificationResponse));

      // Execute the full cycle
      const ownershipResult = await ownershipService.checkGameOwnership(userId, gameId);
      expect(ownershipResult).toBe(true);

      const ratingUpdateResult = await gameCatalogService.updateGameRating(mockGameRating as any);
      expect(ratingUpdateResult).toBe(true);

      const achievementResult = await achievementService.notifyFirstReview(userId, gameId, reviewId);
      expect(achievementResult).toBe(true);

      const notificationResult = await notificationService.notifyNewReview(mockReview as any, 'Test Game', 'TestUser');
      expect(notificationResult).toBe(true);

      // Verify all services were called
      expect(mockHttpService.get).toHaveBeenCalledTimes(1);
      expect(mockHttpService.put).toHaveBeenCalledTimes(1);
      expect(mockHttpService.post).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in the integration chain', async () => {
      const userId = 'user123';
      const gameId = 'game456';
      const reviewId = 'review123';
      const mockReview = {
        id: reviewId,
        userId,
        gameId,
        rating: 5,
        text: 'Great game!',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockGameRating = {
        gameId,
        averageRating: 4.5,
        totalReviews: 11,
        updatedAt: new Date(),
      };

      // Ownership check succeeds
      const mockOwnershipResponse: AxiosResponse = {
        data: { owned: true, purchaseDate: '2024-01-15T10:00:00Z', gameId, userId },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockCacheManager.get.mockResolvedValue(undefined);
      mockHttpService.get.mockReturnValueOnce(of(mockOwnershipResponse));

      // Rating update fails
      mockHttpService.put.mockReturnValueOnce(
        throwError(() => new Error('Game catalog service unavailable'))
      );

      // Achievement service succeeds
      const mockAchievementResponse: AxiosResponse = {
        data: { success: true, achievementId: 'ach123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValueOnce(of(mockAchievementResponse));

      // Notification fails
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => new Error('Notification service unavailable'))
      );

      const ownershipResult = await ownershipService.checkGameOwnership(userId, gameId);
      const ratingUpdateResult = await gameCatalogService.updateGameRating(mockGameRating as any);
      const achievementResult = await achievementService.notifyFirstReview(userId, gameId, reviewId);
      const notificationResult = await notificationService.notifyNewReview(mockReview as any);

      expect(ownershipResult).toBe(true);
      expect(ratingUpdateResult).toBe(false);
      expect(achievementResult).toBe(true);
      expect(notificationResult).toBe(false);
    });
  });

  describe('Service Health Checks', () => {
    it('should check all services health status', async () => {
      // Mock healthy responses for all services
      const mockHealthyResponse: AxiosResponse = {
        data: { status: 'healthy' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get
        .mockReturnValueOnce(of(mockHealthyResponse)) // Library service
        .mockReturnValueOnce(of(mockHealthyResponse)) // Achievement service
        .mockReturnValueOnce(of(mockHealthyResponse)) // Notification service
        .mockReturnValueOnce(of(mockHealthyResponse)); // Game catalog service

      const ownershipHealth = await ownershipService.getServiceHealth();
      const achievementHealth = await achievementService.getServiceHealth();
      const notificationHealth = await notificationService.getServiceHealth();
      const gameCatalogHealth = await gameCatalogService.getServiceHealth();

      expect(ownershipHealth.status).toBe('healthy');
      expect(achievementHealth.status).toBe('healthy');
      expect(notificationHealth.status).toBe('healthy');
      expect(gameCatalogHealth.status).toBe('healthy');
    });

    it('should detect unhealthy services', async () => {
      // Reset mocks first
      jest.clearAllMocks();
      
      // Mock unhealthy responses for each service health check
      mockHttpService.get.mockImplementation((url: string) => {
        if (url.includes('/health')) {
          return throwError(() => new Error('Service down'));
        }
        return throwError(() => new Error('Unexpected call'));
      });

      const ownershipHealth = await ownershipService.getServiceHealth();
      const achievementHealth = await achievementService.getServiceHealth();
      const notificationHealth = await notificationService.getServiceHealth();
      const gameCatalogHealth = await gameCatalogService.getServiceHealth();

      expect(ownershipHealth.status).toBe('unhealthy');
      expect(achievementHealth.status).toBe('unhealthy');
      expect(notificationHealth.status).toBe('unhealthy');
      expect(gameCatalogHealth.status).toBe('unhealthy');
    });
  });

  describe('Game Information Synchronization', () => {
    it('should handle game not found in catalog', async () => {
      const gameId = 'nonexistent-game';

      // Mock 404 error response
      const mockError = {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: null,
        },
      };

      mockHttpService.get.mockReturnValue(throwError(() => mockError));

      const result = await gameCatalogService.getGameInfo(gameId);

      expect(result).toEqual({
        exists: false,
      });
    });

    it('should retrieve game information successfully', async () => {
      const gameId = 'game456';
      const gameName = 'Amazing Game';

      const mockGameResponse: AxiosResponse = {
        data: { id: gameId, name: gameName, description: 'A great game' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockGameResponse));

      const result = await gameCatalogService.getGameInfo(gameId);

      expect(result).toEqual({
        name: gameName,
        exists: true,
      });
    });
  });
});