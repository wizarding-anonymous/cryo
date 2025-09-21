import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { ReviewService } from './review.service';
import { OwnershipService } from './ownership.service';
import { RatingService } from './rating.service';
import { Review } from '../entities/review.entity';
import { CreateReviewDto } from '../dto/create-review.dto';
import { UpdateReviewDto } from '../dto/update-review.dto';
import { ExternalIntegrationService } from './external-integration.service';
import { MetricsService } from './metrics.service';

describe('ReviewService', () => {
  let service: ReviewService;
  let reviewRepository: jest.Mocked<Repository<Review>>;
  let ownershipService: jest.Mocked<OwnershipService>;
  let ratingService: jest.Mocked<RatingService>;
  let externalIntegrationService: jest.Mocked<ExternalIntegrationService>;

  const mockReview: Review = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userId: 'user-123',
    gameId: 'game-456',
    text: 'Great game!',
    rating: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn(),
      remove: jest.fn(),
    };

    const mockOwnershipService = {
      checkGameOwnership: jest.fn(),
    };

    const mockRatingService = {
      updateGameRating: jest.fn(),
    };



    const mockExternalIntegrationService = {
      validateGameExists: jest.fn(),
      notifyFirstReviewAchievement: jest.fn(),
      notifyReviewAction: jest.fn(),
      getGameInfo: jest.fn(),
      healthCheck: jest.fn(),
    };

    const mockMetricsService = {
      recordRatingCalculation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        {
          provide: getRepositoryToken(Review),
          useValue: mockRepository,
        },
        {
          provide: OwnershipService,
          useValue: mockOwnershipService,
        },
        {
          provide: RatingService,
          useValue: mockRatingService,
        },
        {
          provide: ExternalIntegrationService,
          useValue: mockExternalIntegrationService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
    reviewRepository = module.get(getRepositoryToken(Review));
    ownershipService = module.get(OwnershipService);
    ratingService = module.get(RatingService);
    externalIntegrationService = module.get(ExternalIntegrationService);
  });

  describe('createReview', () => {
    const createReviewDto: CreateReviewDto = {
      gameId: 'game-456',
      text: 'Great game!',
      rating: 5,
    };

    it('should create a review successfully', async () => {
      externalIntegrationService.validateGameExists.mockResolvedValue(true);
      ownershipService.checkGameOwnership.mockResolvedValue(true);
      reviewRepository.findOne.mockResolvedValue(null);
      reviewRepository.create.mockReturnValue(mockReview);
      reviewRepository.save.mockResolvedValue(mockReview);
      reviewRepository.count.mockResolvedValue(1);
      ratingService.updateGameRating.mockResolvedValue({} as any);

      const result = await service.createReview('user-123', createReviewDto);

      expect(result).toEqual(mockReview);
      expect(ownershipService.checkGameOwnership).toHaveBeenCalledWith('user-123', 'game-456');
      expect(reviewRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-123', gameId: 'game-456' },
      });
      expect(ratingService.updateGameRating).toHaveBeenCalledWith('game-456');
    });

    it('should throw ForbiddenException if user does not own the game', async () => {
      externalIntegrationService.validateGameExists.mockResolvedValue(true);
      ownershipService.checkGameOwnership.mockResolvedValue(false);

      await expect(service.createReview('user-123', createReviewDto))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if review already exists', async () => {
      externalIntegrationService.validateGameExists.mockResolvedValue(true);
      ownershipService.checkGameOwnership.mockResolvedValue(true);
      reviewRepository.findOne.mockResolvedValue(mockReview);

      await expect(service.createReview('user-123', createReviewDto))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('updateReview', () => {
    const updateReviewDto: UpdateReviewDto = {
      text: 'Updated review text',
      rating: 4,
    };

    it('should update a review successfully', async () => {
      reviewRepository.findOne.mockResolvedValue(mockReview);
      reviewRepository.save.mockResolvedValue({ ...mockReview, ...updateReviewDto });
      ratingService.updateGameRating.mockResolvedValue({} as any);

      const result = await service.updateReview('123e4567-e89b-12d3-a456-426614174000', 'user-123', updateReviewDto);

      expect(result.text).toBe(updateReviewDto.text);
      expect(result.rating).toBe(updateReviewDto.rating);
      expect(ratingService.updateGameRating).toHaveBeenCalledWith('game-456');
    });

    it('should throw NotFoundException if review does not exist', async () => {
      reviewRepository.findOne.mockResolvedValue(null);

      await expect(service.updateReview('non-existent', 'user-123', updateReviewDto))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the owner', async () => {
      reviewRepository.findOne.mockResolvedValue(mockReview);

      await expect(service.updateReview('123e4567-e89b-12d3-a456-426614174000', 'other-user', updateReviewDto))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteReview', () => {
    it('should delete a review successfully', async () => {
      reviewRepository.findOne.mockResolvedValue(mockReview);
      reviewRepository.remove.mockResolvedValue(mockReview);
      ratingService.updateGameRating.mockResolvedValue({} as any);

      await service.deleteReview('123e4567-e89b-12d3-a456-426614174000', 'user-123');

      expect(reviewRepository.remove).toHaveBeenCalledWith(mockReview);
      expect(ratingService.updateGameRating).toHaveBeenCalledWith('game-456');
    });

    it('should throw NotFoundException if review does not exist', async () => {
      reviewRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteReview('non-existent', 'user-123'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the owner', async () => {
      reviewRepository.findOne.mockResolvedValue(mockReview);

      await expect(service.deleteReview('123e4567-e89b-12d3-a456-426614174000', 'other-user'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('getGameReviews', () => {
    it('should return paginated game reviews', async () => {
      const reviews = [mockReview];
      reviewRepository.findAndCount.mockResolvedValue([reviews, 1]);

      const result = await service.getGameReviews('game-456', { page: 1, limit: 10 });

      expect(result).toEqual({
        reviews,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });
  });

  describe('getUserReviews', () => {
    it('should return paginated user reviews', async () => {
      const reviews = [mockReview];
      reviewRepository.findAndCount.mockResolvedValue([reviews, 1]);

      const result = await service.getUserReviews('user-123', { page: 1, limit: 10 });

      expect(result).toEqual({
        reviews,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });
  });
});