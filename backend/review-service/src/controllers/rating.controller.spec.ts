import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RatingController } from './rating.controller';
import { RatingService } from '../services/rating.service';
import { GameRating } from '../entities/game-rating.entity';

describe('RatingController', () => {
  let controller: RatingController;
  let ratingService: RatingService;

  const mockGameRating: GameRating = {
    gameId: 'game-456',
    averageRating: 4.25,
    totalReviews: 42,
    updatedAt: new Date('2024-01-16T14:20:00Z'),
  };

  const mockRatingService = {
    getGameRating: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RatingController],
      providers: [
        {
          provide: RatingService,
          useValue: mockRatingService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    controller = module.get<RatingController>(RatingController);
    ratingService = module.get<RatingService>(RatingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getGameRating', () => {
    it('should return game rating when it exists', async () => {
      const gameId = 'game-456';
      mockRatingService.getGameRating.mockResolvedValue(mockGameRating);

      const result = await controller.getGameRating(gameId);

      expect(ratingService.getGameRating).toHaveBeenCalledWith(gameId);
      expect(result).toEqual(mockGameRating);
    });

    it('should return default response when rating does not exist', async () => {
      const gameId = 'game-789';
      mockRatingService.getGameRating.mockResolvedValue(null);

      const result = await controller.getGameRating(gameId);

      expect(ratingService.getGameRating).toHaveBeenCalledWith(gameId);
      expect(result).toEqual({
        gameId: 'game-789',
        averageRating: 0,
        totalReviews: 0,
        message: 'No reviews yet',
      });
    });
  });
});