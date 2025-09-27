import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ReviewService } from './review.service';

// Mock fetch globally
global.fetch = jest.fn();

describe('ReviewService', () => {
  let service: ReviewService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://review-service:3000'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
    configService = module.get<ConfigService>(ConfigService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('getReview', () => {
    it('should get review successfully', async () => {
      const mockReview = {
        reviewId: 'review-1',
        userId: 'user-1',
        gameId: 'game-1',
        rating: 5,
        content: 'Great game!',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ review: mockReview }),
      });

      const result = await service.getReview('review-1');

      expect(result).toEqual(mockReview);
      expect(fetch).toHaveBeenCalledWith(
        'http://review-service:3000/api/reviews/review-1',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );
    });

    it('should return null when review not found', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await service.getReview('review-nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when service error occurs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.getReview('review-1');

      expect(result).toBeNull();
    });

    it('should return null when network error occurs', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.getReview('review-1');

      expect(result).toBeNull();
    });
  });

  describe('getUserReviews', () => {
    it('should get user reviews successfully', async () => {
      const mockReviews = [
        {
          reviewId: 'review-1',
          userId: 'user-1',
          gameId: 'game-1',
          rating: 5,
          content: 'Great game!',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ reviews: mockReviews }),
      });

      const result = await service.getUserReviews('user-1');

      expect(result).toEqual(mockReviews);
      expect(fetch).toHaveBeenCalledWith(
        'http://review-service:3000/api/users/user-1/reviews?limit=50&offset=0',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );
    });

    it('should return empty array when service error occurs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.getUserReviews('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getUserReviewStats', () => {
    it('should get user review stats successfully', async () => {
      const mockStats = {
        totalReviews: 10,
        averageRating: 4.5,
        firstReviewDate: '2024-01-01T00:00:00.000Z',
        lastReviewDate: '2024-01-10T00:00:00.000Z',
        reviewsByRating: {
          1: 0,
          2: 1,
          3: 2,
          4: 3,
          5: 4,
        },
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ stats: mockStats }),
      });

      const result = await service.getUserReviewStats('user-1');

      expect(result).toEqual(mockStats);
    });

    it('should return null when service error occurs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.getUserReviewStats('user-1');

      expect(result).toBeNull();
    });
  });

  describe('getUserReviewCount', () => {
    it('should get user review count successfully', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ count: 10 }),
      });

      const result = await service.getUserReviewCount('user-1');

      expect(result).toBe(10);
      expect(fetch).toHaveBeenCalledWith(
        'http://review-service:3000/api/users/user-1/count',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );
    });

    it('should return 0 when service error occurs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.getUserReviewCount('user-1');

      expect(result).toBe(0);
    });

    it('should return 0 when network error occurs', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.getUserReviewCount('user-1');

      expect(result).toBe(0);
    });
  });

  describe('reviewExists', () => {
    it('should return true when review exists', async () => {
      const mockReview = {
        reviewId: 'review-1',
        userId: 'user-1',
        gameId: 'game-1',
        rating: 5,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ review: mockReview }),
      });

      const result = await service.reviewExists('review-1');

      expect(result).toBe(true);
    });

    it('should return false when review does not exist', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await service.reviewExists('review-nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getUserReviewsForGame', () => {
    it('should get user reviews for game successfully', async () => {
      const mockReviews = [
        {
          reviewId: 'review-1',
          userId: 'user-1',
          gameId: 'game-1',
          rating: 5,
          content: 'Great game!',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ reviews: mockReviews }),
      });

      const result = await service.getUserReviewsForGame('user-1', 'game-1');

      expect(result).toEqual(mockReviews);
      expect(fetch).toHaveBeenCalledWith(
        'http://review-service:3000/api/users/user-1/games/game-1/reviews',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );
    });

    it('should return empty array when service error occurs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.getUserReviewsForGame('user-1', 'game-1');

      expect(result).toEqual([]);
    });
  });

  describe('checkReviewServiceHealth', () => {
    it('should return true when service is healthy', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await service.checkReviewServiceHealth();

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('http://review-service:3000/health', {
        method: 'GET',
        headers: {
          'X-Service-Name': 'achievement-service',
        },
      });
    });

    it('should return false when service is unhealthy', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.checkReviewServiceHealth();

      expect(result).toBe(false);
    });

    it('should return false when network error occurs', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.checkReviewServiceHealth();

      expect(result).toBe(false);
    });
  });

  describe('getFirstReviewInfo', () => {
    it('should get first review info successfully', async () => {
      const mockStats = {
        totalReviews: 5,
        averageRating: 4.5,
        firstReviewDate: '2024-01-01T00:00:00.000Z',
        lastReviewDate: '2024-01-05T00:00:00.000Z',
        reviewsByRating: { 5: 5 },
      };

      const mockReviews = [
        {
          reviewId: 'review-1',
          userId: 'user-1',
          gameId: 'game-1',
          rating: 5,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ stats: mockStats }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ reviews: mockReviews }),
        });

      const result = await service.getFirstReviewInfo('user-1');

      expect(result).toEqual({
        reviewId: 'review-1',
        createdAt: '2024-01-01T00:00:00.000Z',
      });
    });

    it('should return null when no reviews exist', async () => {
      const mockStats = {
        totalReviews: 0,
        averageRating: 0,
        reviewsByRating: {},
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ stats: mockStats }),
      });

      const result = await service.getFirstReviewInfo('user-1');

      expect(result).toBeNull();
    });

    it('should return null when service error occurs', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.getFirstReviewInfo('user-1');

      expect(result).toBeNull();
    });
  });
});