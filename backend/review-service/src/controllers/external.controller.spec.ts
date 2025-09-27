import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ExternalController } from './external.controller';
import { RatingService } from '../services';
import { GameRating } from '../entities/game-rating.entity';

describe('ExternalController', () => {
  let controller: ExternalController;
  let ratingService: RatingService;

  const mockRatingService = {
    getGameRating: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExternalController],
      providers: [
        {
          provide: RatingService,
          useValue: mockRatingService,
        },
      ],
    }).compile();

    controller = module.get<ExternalController>(ExternalController);
    ratingService = module.get<RatingService>(RatingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getGameRating', () => {
    it('should return game rating when it exists', async () => {
      const gameId = 'game-123';
      const gameRating: GameRating = {
        gameId,
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date('2023-01-01T00:00:00Z'),
      };

      mockRatingService.getGameRating.mockResolvedValue(gameRating);

      const result = await controller.getGameRating(gameId);

      expect(result).toEqual({
        gameId: 'game-123',
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date('2023-01-01T00:00:00Z'),
      });
      expect(mockRatingService.getGameRating).toHaveBeenCalledWith(gameId);
    });

    it('should throw 404 when game rating not found', async () => {
      const gameId = 'game-123';

      mockRatingService.getGameRating.mockResolvedValue(null);

      await expect(controller.getGameRating(gameId)).rejects.toThrow(
        new HttpException(
          {
            message: 'No rating found for this game',
            gameId,
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });
  });

  describe('getGameRatingSummary', () => {
    it('should return rating summary when game has rating', async () => {
      const gameId = 'game-123';
      const gameRating: GameRating = {
        gameId,
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date(),
      };

      mockRatingService.getGameRating.mockResolvedValue(gameRating);

      const result = await controller.getGameRatingSummary(gameId);

      expect(result).toEqual({
        rating: 4.25,
        reviewCount: 42,
        hasRating: true,
      });
    });

    it('should return default values when game has no rating', async () => {
      const gameId = 'game-123';

      mockRatingService.getGameRating.mockResolvedValue(null);

      const result = await controller.getGameRatingSummary(gameId);

      expect(result).toEqual({
        rating: 0,
        reviewCount: 0,
        hasRating: false,
      });
    });
  });

  describe('getBatchGameRatings', () => {
    it('should return ratings for multiple games', async () => {
      const gameIds = 'game-123,game-456,game-789';
      
      const gameRating1: GameRating = {
        gameId: 'game-123',
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date(),
      };

      const gameRating2: GameRating = {
        gameId: 'game-456',
        averageRating: 3.75,
        totalReviews: 20,
        updatedAt: new Date(),
      };

      mockRatingService.getGameRating
        .mockResolvedValueOnce(gameRating1)
        .mockResolvedValueOnce(gameRating2)
        .mockResolvedValueOnce(null); // game-789 has no rating

      const result = await controller.getBatchGameRatings(gameIds);

      expect(result).toEqual({
        ratings: {
          'game-123': { rating: 4.25, reviewCount: 42, hasRating: true },
          'game-456': { rating: 3.75, reviewCount: 20, hasRating: true },
          'game-789': { rating: 0, reviewCount: 0, hasRating: false },
        },
      });

      expect(mockRatingService.getGameRating).toHaveBeenCalledTimes(3);
      expect(mockRatingService.getGameRating).toHaveBeenCalledWith('game-123');
      expect(mockRatingService.getGameRating).toHaveBeenCalledWith('game-456');
      expect(mockRatingService.getGameRating).toHaveBeenCalledWith('game-789');
    });

    it('should throw 400 when gameIds parameter is missing', async () => {
      await expect(controller.getBatchGameRatings('')).rejects.toThrow(
        new HttpException(
          {
            message: 'gameIds parameter is required',
            example: '?gameIds=game-123,game-456,game-789'
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw 400 when no valid gameIds provided', async () => {
      await expect(controller.getBatchGameRatings(',,,')).rejects.toThrow(
        new HttpException(
          {
            message: 'At least one valid gameId is required',
            example: '?gameIds=game-123,game-456,game-789'
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should throw 400 when too many gameIds provided', async () => {
      const gameIds = Array.from({ length: 101 }, (_, i) => `game-${i}`).join(',');

      await expect(controller.getBatchGameRatings(gameIds)).rejects.toThrow(
        new HttpException(
          {
            message: 'Maximum 100 games per batch request',
            provided: 101
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should handle individual game rating failures gracefully', async () => {
      const gameIds = 'game-123,game-456';
      
      const gameRating1: GameRating = {
        gameId: 'game-123',
        averageRating: 4.25,
        totalReviews: 42,
        updatedAt: new Date(),
      };

      mockRatingService.getGameRating
        .mockResolvedValueOnce(gameRating1)
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await controller.getBatchGameRatings(gameIds);

      expect(result).toEqual({
        ratings: {
          'game-123': { rating: 4.25, reviewCount: 42, hasRating: true },
          'game-456': { rating: 0, reviewCount: 0, hasRating: false },
        },
      });
    });
  });
});