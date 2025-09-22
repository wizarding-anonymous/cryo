import { Test, TestingModule } from '@nestjs/testing';
import { ApiController } from './api.controller';
import { RatingService } from '../services/rating.service';
import { ReviewService } from '../services/review.service';
import { ExternalIntegrationService } from '../services/external-integration.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

describe('ApiController', () => {
  let controller: ApiController;
  let ratingService: RatingService;
  let reviewService: ReviewService;
  let externalIntegrationService: ExternalIntegrationService;

  const mockRatingService = {
    getGameRating: jest.fn(),
    getGameRatingStats: jest.fn(),
    getTopRatedGames: jest.fn(),
  };

  const mockReviewService = {
    getGameReviews: jest.fn(),
    getUserReviews: jest.fn(),
    getServiceHealthStatus: jest.fn(),
  };

  const mockExternalIntegrationService = {
    healthCheck: jest.fn(),
  };

  const mockJwtAuthGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiController],
      providers: [
        {
          provide: RatingService,
          useValue: mockRatingService,
        },
        {
          provide: ReviewService,
          useValue: mockReviewService,
        },
        {
          provide: ExternalIntegrationService,
          useValue: mockExternalIntegrationService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<ApiController>(ApiController);
    ratingService = module.get<RatingService>(RatingService);
    reviewService = module.get<ReviewService>(ReviewService);
    externalIntegrationService = module.get<ExternalIntegrationService>(ExternalIntegrationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getGameRating', () => {
    it('should return game rating for existing game', async () => {
      const gameId = 'game-123';
      const mockRating = {
        gameId,
        averageRating: 4.5,
        totalReviews: 100,
        updatedAt: new Date('2024-01-01'),
      };

      mockRatingService.getGameRating.mockResolvedValue(mockRating);

      const result = await controller.getGameRating(gameId);

      expect(result).toEqual({
        gameId,
        averageRating: 4.5,
        totalReviews: 100,
        lastUpdated: mockRating.updatedAt,
      });
      expect(mockRatingService.getGameRating).toHaveBeenCalledWith(gameId);
    });

    it('should return zero rating for game with no reviews', async () => {
      const gameId = 'game-456';

      mockRatingService.getGameRating.mockResolvedValue({
        gameId,
        averageRating: 0,
        totalReviews: 0,
        updatedAt: new Date(),
      });

      const result = await controller.getGameRating(gameId);

      expect(result).toEqual({
        gameId,
        averageRating: 0,
        totalReviews: 0,
        lastUpdated: null,
      });
    });

    it('should return zero rating for non-existent game', async () => {
      const gameId = 'non-existent';

      mockRatingService.getGameRating.mockResolvedValue(null);

      const result = await controller.getGameRating(gameId);

      expect(result).toEqual({
        gameId,
        averageRating: 0,
        totalReviews: 0,
        lastUpdated: null,
      });
    });
  });

  describe('getGameReviews', () => {
    it('should return paginated game reviews', async () => {
      const gameId = 'game-123';
      const paginationDto = { page: 1, limit: 10 };
      const mockReviews = {
        reviews: [
          {
            id: 'review-1',
            userId: 'user-1',
            gameId,
            rating: 5,
            text: 'Great game!',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockReviewService.getGameReviews.mockResolvedValue(mockReviews);

      const result = await controller.getGameReviews(gameId, paginationDto);

      expect(result).toEqual({
        gameId,
        reviews: mockReviews.reviews,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });
      expect(mockReviewService.getGameReviews).toHaveBeenCalledWith(gameId, paginationDto);
    });
  });

  describe('getBulkGameRatings', () => {
    it('should return ratings for multiple games', async () => {
      const gameIds = 'game-1,game-2,game-3';
      const mockRatings = [
        {
          gameId: 'game-1',
          averageRating: 4.5,
          totalReviews: 100,
          updatedAt: new Date('2024-01-01'),
        },
        {
          gameId: 'game-2',
          averageRating: 3.8,
          totalReviews: 50,
          updatedAt: new Date('2024-01-02'),
        },
        null, // game-3 has no rating
      ];

      mockRatingService.getGameRating
        .mockResolvedValueOnce(mockRatings[0])
        .mockResolvedValueOnce(mockRatings[1])
        .mockResolvedValueOnce(mockRatings[2]);

      const result = await controller.getBulkGameRatings(gameIds);

      expect(result.ratings).toHaveLength(3);
      expect(result.ratings[0]).toEqual({
        gameId: 'game-1',
        averageRating: 4.5,
        totalReviews: 100,
        lastUpdated: mockRatings[0].updatedAt,
      });
      expect(result.ratings[2]).toEqual({
        gameId: 'game-3',
        averageRating: 0,
        totalReviews: 0,
        lastUpdated: null,
      });
    });

    it('should return empty array for no game IDs', async () => {
      const result = await controller.getBulkGameRatings('');

      expect(result).toEqual({ ratings: [] });
      expect(mockRatingService.getGameRating).not.toHaveBeenCalled();
    });

    it('should limit to 100 games maximum', async () => {
      const gameIds = Array.from({ length: 150 }, (_, i) => `game-${i}`).join(',');

      mockRatingService.getGameRating.mockResolvedValue({
        gameId: 'game-0',
        averageRating: 4.0,
        totalReviews: 10,
        updatedAt: new Date(),
      });

      const result = await controller.getBulkGameRatings(gameIds);

      expect(mockRatingService.getGameRating).toHaveBeenCalledTimes(100);
      expect(result.ratings).toHaveLength(100);
    });
  });

  describe('getUserReviews', () => {
    it('should return user reviews with pagination', async () => {
      const userId = 'user-123';
      const paginationDto = { page: 1, limit: 10 };
      const mockUserReviews = {
        reviews: [
          {
            id: 'review-1',
            userId,
            gameId: 'game-1',
            rating: 5,
            text: 'Amazing!',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockReviewService.getUserReviews.mockResolvedValue(mockUserReviews);

      const result = await controller.getUserReviews(userId, paginationDto);

      expect(result).toEqual({
        userId,
        reviews: mockUserReviews.reviews,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });
      expect(mockReviewService.getUserReviews).toHaveBeenCalledWith(userId, paginationDto);
    });
  });

  describe('getRatingStatistics', () => {
    it('should return comprehensive rating statistics', async () => {
      const mockStats = {
        totalGamesWithRatings: 1000,
        averageRatingAcrossAllGames: 4.2,
        totalReviewsCount: 15000,
      };

      const mockTopRatedGames = [
        {
          gameId: 'game-1',
          averageRating: 4.9,
          totalReviews: 200,
        },
        {
          gameId: 'game-2',
          averageRating: 4.8,
          totalReviews: 150,
        },
      ];

      mockRatingService.getGameRatingStats.mockResolvedValue(mockStats);
      mockRatingService.getTopRatedGames.mockResolvedValue(mockTopRatedGames);

      const result = await controller.getRatingStatistics();

      expect(result).toEqual({
        ...mockStats,
        topRatedGames: mockTopRatedGames.map(game => ({
          gameId: game.gameId,
          averageRating: game.averageRating,
          totalReviews: game.totalReviews,
        })),
      });
      expect(mockRatingService.getGameRatingStats).toHaveBeenCalled();
      expect(mockRatingService.getTopRatedGames).toHaveBeenCalledWith(10);
    });
  });

  describe('checkGameOwnership', () => {
    it('should check game ownership through user reviews', async () => {
      const body = { userId: 'user-123', gameId: 'game-456' };
      const mockUserReviews = {
        reviews: [],
        total: 1,
        page: 1,
        limit: 1,
        totalPages: 1,
      };

      mockReviewService.getUserReviews.mockResolvedValue(mockUserReviews);

      const result = await controller.checkGameOwnership(body);

      expect(result).toEqual({
        userId: body.userId,
        gameId: body.gameId,
        ownsGame: true,
        checkedAt: expect.any(String),
      });
      expect(mockReviewService.getUserReviews).toHaveBeenCalledWith(body.userId, { page: 1, limit: 1 });
    });

    it('should return false for user with no reviews', async () => {
      const body = { userId: 'user-123', gameId: 'game-456' };
      const mockUserReviews = {
        reviews: [],
        total: 0,
        page: 1,
        limit: 1,
        totalPages: 0,
      };

      mockReviewService.getUserReviews.mockResolvedValue(mockUserReviews);

      const result = await controller.checkGameOwnership(body);

      expect(result.ownsGame).toBe(false);
    });
  });

  describe('getIntegrationsHealth', () => {
    it('should return health status of all integrations', async () => {
      const mockHealthStatus = {
        library: true,
        gameCatalog: true,
        achievement: false,
        notification: true,
      };

      mockReviewService.getServiceHealthStatus.mockResolvedValue(mockHealthStatus);

      const result = await controller.getIntegrationsHealth();

      expect(result).toEqual({
        ...mockHealthStatus,
        checkedAt: expect.any(String),
      });
      expect(mockReviewService.getServiceHealthStatus).toHaveBeenCalled();
    });

    it('should handle health check failures gracefully', async () => {
      mockReviewService.getServiceHealthStatus.mockRejectedValue(new Error('Health check failed'));

      await expect(controller.getIntegrationsHealth()).rejects.toThrow('Health check failed');
    });
  });

  describe('Integration API Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const gameId = 'game-123';
      const mockRating = {
        gameId,
        averageRating: 4.5,
        totalReviews: 100,
        updatedAt: new Date(),
      };

      mockRatingService.getGameRating.mockResolvedValue(mockRating);

      // Simulate 10 concurrent requests
      const promises = Array.from({ length: 10 }, () => 
        controller.getGameRating(gameId)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.gameId).toBe(gameId);
        expect(result.averageRating).toBe(4.5);
      });
    });

    it('should handle bulk operations efficiently', async () => {
      const gameIds = Array.from({ length: 50 }, (_, i) => `game-${i}`).join(',');

      mockRatingService.getGameRating.mockImplementation((gameId) => 
        Promise.resolve({
          gameId,
          averageRating: 4.0,
          totalReviews: 10,
          updatedAt: new Date(),
        })
      );

      const startTime = Date.now();
      const result = await controller.getBulkGameRatings(gameIds);
      const duration = Date.now() - startTime;

      expect(result.ratings).toHaveLength(50);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(mockRatingService.getGameRating).toHaveBeenCalledTimes(50);
    });
  });

  describe('Error Handling', () => {
    it('should handle rating service errors gracefully', async () => {
      const gameId = 'game-123';

      mockRatingService.getGameRating.mockRejectedValue(new Error('Database connection failed'));

      await expect(controller.getGameRating(gameId)).rejects.toThrow('Database connection failed');
    });

    it('should handle partial failures in bulk operations', async () => {
      const gameIds = 'game-1,game-2,game-3';

      mockRatingService.getGameRating
        .mockResolvedValueOnce({
          gameId: 'game-1',
          averageRating: 4.5,
          totalReviews: 100,
          updatedAt: new Date(),
        })
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValueOnce({
          gameId: 'game-3',
          averageRating: 3.8,
          totalReviews: 50,
          updatedAt: new Date(),
        });

      const result = await controller.getBulkGameRatings(gameIds);

      // Should return successful results and skip failed ones
      expect(result.ratings).toHaveLength(2);
      expect(result.ratings[0].gameId).toBe('game-1');
      expect(result.ratings[1].gameId).toBe('game-3');
    });
  });
});