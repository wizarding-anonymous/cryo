import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RatingSchedulerService } from './rating-scheduler.service';
import { RatingService } from './rating.service';
import { MetricsService } from './metrics.service';
import { GameRating } from '../entities/game-rating.entity';
import { Review } from '../entities/review.entity';

describe('RatingSchedulerService', () => {
  let service: RatingSchedulerService;
  let gameRatingRepository: Repository<GameRating>;
  let reviewRepository: Repository<Review>;
  let ratingService: RatingService;
  let metricsService: MetricsService;

  const mockGameRatingRepository = {
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
  };

  const mockReviewRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockRatingService = {
    updateGameRating: jest.fn(),
  };

  const mockMetricsService = {
    recordRatingCalculation: jest.fn(),
    recordRatingCalculationDuration: jest.fn(),
    incrementActiveCalculations: jest.fn(),
    decrementActiveCalculations: jest.fn(),
    updateCachedRatingsCount: jest.fn(),
    getRatingMetricsSummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingSchedulerService,
        {
          provide: getRepositoryToken(GameRating),
          useValue: mockGameRatingRepository,
        },
        {
          provide: getRepositoryToken(Review),
          useValue: mockReviewRepository,
        },
        {
          provide: RatingService,
          useValue: mockRatingService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<RatingSchedulerService>(RatingSchedulerService);
    gameRatingRepository = module.get<Repository<GameRating>>(getRepositoryToken(GameRating));
    reviewRepository = module.get<Repository<Review>>(getRepositoryToken(Review));
    ratingService = module.get<RatingService>(RatingService);
    metricsService = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recalculateRatingsForGames', () => {
    it('should recalculate ratings for provided games', async () => {
      const gameIds = ['game-1', 'game-2', 'game-3'];
      
      mockRatingService.updateGameRating.mockResolvedValue({});

      const result = await service.recalculateRatingsForGames(gameIds);

      expect(result.processed).toBe(3);
      expect(result.errors).toBe(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockRatingService.updateGameRating).toHaveBeenCalledTimes(3);
      expect(mockMetricsService.recordRatingCalculation).toHaveBeenCalledTimes(3);
    });

    it('should handle errors during recalculation', async () => {
      const gameIds = ['game-1', 'game-2'];
      
      mockRatingService.updateGameRating
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await service.recalculateRatingsForGames(gameIds);

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(1);
      expect(mockRatingService.updateGameRating).toHaveBeenCalledTimes(2);
    });

    it('should track active calculations', async () => {
      const gameIds = ['game-1'];
      
      mockRatingService.updateGameRating.mockResolvedValue({});

      await service.recalculateRatingsForGames(gameIds);

      expect(mockMetricsService.incrementActiveCalculations).toHaveBeenCalledTimes(1);
      expect(mockMetricsService.decrementActiveCalculations).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSchedulerStatus', () => {
    it('should return scheduler status', () => {
      const status = service.getSchedulerStatus();

      expect(status).toHaveProperty('isRecalculationRunning');
      expect(status).toHaveProperty('nextRecalculationTime');
      expect(typeof status.isRecalculationRunning).toBe('boolean');
      expect(status.nextRecalculationTime).toBeInstanceOf(Date);
    });

    it('should calculate next recalculation time correctly', () => {
      const status = service.getSchedulerStatus();
      const now = new Date();
      const nextRun = status.nextRecalculationTime;

      expect(nextRun).toBeDefined();
      expect(nextRun).toBeInstanceOf(Date);
      
      if (nextRun) {
        expect(nextRun.getHours()).toBe(2);
        expect(nextRun.getMinutes()).toBe(0);
        expect(nextRun.getSeconds()).toBe(0);
        
        // Должно быть либо сегодня (если еще не 2:00), либо завтра
        if (now.getHours() >= 2) {
          expect(nextRun.getDate()).toBe(now.getDate() + 1);
        } else {
          expect(nextRun.getDate()).toBe(now.getDate());
        }
      }
    });
  });

  describe('cleanupStaleRatings', () => {
    it('should remove stale rating records', async () => {
      const staleRatings = [
        { gameId: 'game-1', averageRating: 4.5, totalReviews: 0 },
        { gameId: 'game-2', averageRating: 3.0, totalReviews: 0 },
      ];

      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(staleRatings),
      };

      mockGameRatingRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockGameRatingRepository.remove.mockResolvedValue(staleRatings);

      await service.cleanupStaleRatings();

      expect(mockGameRatingRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockGameRatingRepository.remove).toHaveBeenCalledWith(staleRatings);
    });

    it('should not remove anything if no stale ratings found', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockGameRatingRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.cleanupStaleRatings();

      expect(mockGameRatingRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('updateMetrics', () => {
    it('should update cache statistics', async () => {
      mockGameRatingRepository.count.mockResolvedValue(150);
      mockMetricsService.getRatingMetricsSummary.mockResolvedValue({
        totalCalculations: 1000,
        totalCacheOperations: 500,
        activeCalculations: 2,
        cachedRatingsCount: 150,
        averageCalculationTime: 0.05,
      });

      await service.updateMetrics();

      expect(mockMetricsService.updateCachedRatingsCount).toHaveBeenCalledWith(150);
    });

    it('should handle errors gracefully', async () => {
      mockGameRatingRepository.count.mockRejectedValue(new Error('Database error'));

      // Не должно выбрасывать исключение
      await expect(service.updateMetrics()).resolves.not.toThrow();
    });
  });
});