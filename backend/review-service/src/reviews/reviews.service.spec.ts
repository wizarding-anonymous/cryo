import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';

import { ReviewsService } from './reviews.service';
import { RatingsService } from './ratings.service';
import { OwnershipService } from './ownership.service';
import { Review } from '../entities/review.entity';
import { CreateReviewDto } from './dto/review.dto';

// Mock data
const mockUserId = 'user-123';
const mockGameId = 'game-456';
const mockReviewId = 'review-789';

const mockReview: Review = {
  id: mockReviewId,
  userId: mockUserId,
  gameId: mockGameId,
  text: 'This is a test review.',
  rating: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createReviewDto: CreateReviewDto = {
  gameId: mockGameId,
  text: 'A new review.',
  rating: 4,
};

// Mock providers
const mockReviewRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  findAndCount: jest.fn(),
  merge: jest.fn(),
  delete: jest.fn(),
};

const mockRatingsService = {
  updateGameRating: jest.fn(),
};

const mockOwnershipService = {
  checkGameOwnership: jest.fn(),
};

describe('ReviewsService', () => {
  let service: ReviewsService;
  let repository: Repository<Review>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: getRepositoryToken(Review),
          useValue: mockReviewRepository,
        },
        {
          provide: RatingsService,
          useValue: mockRatingsService,
        },
        {
          provide: OwnershipService,
          useValue: mockOwnershipService,
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    repository = module.get<Repository<Review>>(getRepositoryToken(Review));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReview', () => {
    it('should create and return a review successfully', async () => {
      mockOwnershipService.checkGameOwnership.mockResolvedValue(true);
      mockReviewRepository.findOne.mockResolvedValue(null);
      mockReviewRepository.create.mockReturnValue(createReviewDto as any);
      mockReviewRepository.save.mockResolvedValue(mockReview);
      mockRatingsService.updateGameRating.mockResolvedValue(undefined);

      const result = await service.createReview(mockUserId, createReviewDto);

      expect(result).toEqual(mockReview);
      expect(mockOwnershipService.checkGameOwnership).toHaveBeenCalledWith(mockUserId, mockGameId);
      expect(mockReviewRepository.findOne).toHaveBeenCalledWith({ where: { userId: mockUserId, gameId: mockGameId } });
      expect(mockReviewRepository.create).toHaveBeenCalledWith({ userId: mockUserId, ...createReviewDto });
      expect(mockReviewRepository.save).toHaveBeenCalledWith(createReviewDto);
      expect(mockRatingsService.updateGameRating).toHaveBeenCalledWith(mockGameId);
    });

    it('should throw ForbiddenException if user does not own the game', async () => {
      mockOwnershipService.checkGameOwnership.mockResolvedValue(false);

      await expect(service.createReview(mockUserId, createReviewDto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if review already exists', async () => {
      mockOwnershipService.checkGameOwnership.mockResolvedValue(true);
      mockReviewRepository.findOne.mockResolvedValue(mockReview);

      await expect(service.createReview(mockUserId, createReviewDto)).rejects.toThrow(ConflictException);
    });
  });

  // Additional tests for other methods would go here...
});
