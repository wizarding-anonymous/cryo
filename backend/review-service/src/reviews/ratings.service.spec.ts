import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import { RatingsService } from './ratings.service';
import { GameRating } from '../entities/game-rating.entity';
import { Review } from '../entities/review.entity';

const mockGameId = 'game-456';
const mockGameRating: GameRating = {
  gameId: mockGameId,
  averageRating: 4.5,
  totalReviews: 10,
  updatedAt: new Date(),
};

const mockReviewRepository = {
  createQueryBuilder: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getRawOne: jest.fn(),
};

const mockGameRatingRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('RatingsService', () => {
  let service: RatingsService;
  let cacheManager: Cache;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingsService,
        {
          provide: getRepositoryToken(GameRating),
          useValue: mockGameRatingRepository,
        },
        {
          provide: getRepositoryToken(Review),
          useValue: mockReviewRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<RatingsService>(RatingsService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateGameRating', () => {
    it('should calculate, save, and invalidate cache for a game rating', async () => {
      mockReviewRepository.getRawOne.mockResolvedValue({ totalReviews: '10', averageRating: '4.5' });
      mockGameRatingRepository.create.mockReturnValue(mockGameRating);
      mockGameRatingRepository.save.mockResolvedValue(mockGameRating);

      const result = await service.updateGameRating(mockGameId);

      expect(result).toEqual(mockGameRating);
      expect(mockReviewRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockGameRatingRepository.save).toHaveBeenCalledWith(mockGameRating);
      expect(mockCacheManager.del).toHaveBeenCalledWith(`game-rating:${mockGameId}`);
    });
  });

  describe('getGameRating', () => {
    it('should return rating from cache if available', async () => {
      mockCacheManager.get.mockResolvedValue(mockGameRating);
      const result = await service.getGameRating(mockGameId);
      expect(result).toEqual(mockGameRating);
      expect(mockGameRatingRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return rating from DB and set cache if not in cache', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockGameRatingRepository.findOne.mockResolvedValue(mockGameRating);

      const result = await service.getGameRating(mockGameId);

      expect(result).toEqual(mockGameRating);
      expect(mockGameRatingRepository.findOne).toHaveBeenCalledWith({ where: { gameId: mockGameId } });
      expect(mockCacheManager.set).toHaveBeenCalledWith(`game-rating:${mockGameId}`, mockGameRating, 300);
    });

    it('should return a default rating object if not in cache or DB', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockGameRatingRepository.findOne.mockResolvedValue(null);

      const result = await service.getGameRating(mockGameId);

      expect(result.averageRating).toBe(0);
      expect(result.totalReviews).toBe(0);
      expect(mockCacheManager.set).toHaveBeenCalled();
    });
  });
});
