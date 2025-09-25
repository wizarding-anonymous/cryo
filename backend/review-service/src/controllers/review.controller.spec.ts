import { Test, TestingModule } from '@nestjs/testing';
import { ReviewController } from './review.controller';
import { ReviewService } from '../services/review.service';
import { CreateReviewDto, UpdateReviewDto, PaginationDto } from '../dto';
import { Review } from '../entities/review.entity';
import { AuthenticatedRequest } from '../guards/jwt-auth.guard';

describe('ReviewController', () => {
  let controller: ReviewController;
  let reviewService: ReviewService;

  const mockReview: Review = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userId: 'user-123',
    gameId: 'game-456',
    text: 'This is a great game!',
    rating: 5,
    createdAt: new Date('2024-01-15T10:30:00Z'),
    updatedAt: new Date('2024-01-15T10:30:00Z'),
  };

  const mockReviewService = {
    createReview: jest.fn(),
    getGameReviews: jest.fn(),
    updateReview: jest.fn(),
    deleteReview: jest.fn(),
    getUserReviews: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewController],
      providers: [
        {
          provide: ReviewService,
          useValue: mockReviewService,
        },
      ],
    }).compile();

    controller = module.get<ReviewController>(ReviewController);
    reviewService = module.get<ReviewService>(ReviewService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createReview', () => {
    it('should create a review successfully', async () => {
      const createReviewDto: CreateReviewDto = {
        gameId: 'game-456',
        text: 'This is a great game!',
        rating: 5,
      };

      const mockRequest = { 
        user: { id: 'user-123', email: 'test@example.com' } 
      } as AuthenticatedRequest;
      mockReviewService.createReview.mockResolvedValue(mockReview);

      const result = await controller.createReview(mockRequest, createReviewDto);

      expect(reviewService.createReview).toHaveBeenCalledWith('user-123', createReviewDto);
      expect(result).toEqual(mockReview);
    });

    it('should handle authenticated request properly', async () => {
      const createReviewDto: CreateReviewDto = {
        gameId: 'game-456',
        text: 'This is a great game!',
        rating: 5,
      };

      const mockRequest = { 
        user: { id: 'user-123', email: 'test@example.com' } 
      } as AuthenticatedRequest;
      mockReviewService.createReview.mockResolvedValue(mockReview);

      const result = await controller.createReview(mockRequest, createReviewDto);

      expect(reviewService.createReview).toHaveBeenCalledWith('user-123', createReviewDto);
      expect(result).toEqual(mockReview);
    });
  });

  describe('getGameReviews', () => {
    it('should get game reviews with pagination', async () => {
      const gameId = 'game-456';
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const mockResponse = {
        reviews: [mockReview],
        total: 1,
      };

      mockReviewService.getGameReviews.mockResolvedValue(mockResponse);

      const result = await controller.getGameReviews(gameId, paginationDto);

      expect(reviewService.getGameReviews).toHaveBeenCalledWith(gameId, paginationDto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateReview', () => {
    it('should update a review successfully', async () => {
      const reviewId = '123e4567-e89b-12d3-a456-426614174000';
      const updateReviewDto: UpdateReviewDto = {
        text: 'Updated review text',
        rating: 4,
      };

      const mockRequest = { 
        user: { id: 'user-123', email: 'test@example.com' } 
      } as AuthenticatedRequest;
      const updatedReview = { ...mockReview, ...updateReviewDto };
      mockReviewService.updateReview.mockResolvedValue(updatedReview);

      const result = await controller.updateReview(reviewId, mockRequest, updateReviewDto);

      expect(reviewService.updateReview).toHaveBeenCalledWith(reviewId, 'user-123', updateReviewDto);
      expect(result).toEqual(updatedReview);
    });
  });

  describe('deleteReview', () => {
    it('should delete a review successfully', async () => {
      const reviewId = '123e4567-e89b-12d3-a456-426614174000';
      const mockRequest = { 
        user: { id: 'user-123', email: 'test@example.com' } 
      } as AuthenticatedRequest;

      mockReviewService.deleteReview.mockResolvedValue(undefined);

      const result = await controller.deleteReview(reviewId, mockRequest);

      expect(reviewService.deleteReview).toHaveBeenCalledWith(reviewId, 'user-123');
      expect(result).toBeUndefined();
    });
  });

  describe('getUserReviews', () => {
    it('should get user reviews with pagination', async () => {
      const userId = 'user-123';
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const mockResponse = {
        reviews: [mockReview],
        total: 1,
      };

      mockReviewService.getUserReviews.mockResolvedValue(mockResponse);

      const result = await controller.getUserReviews(userId, paginationDto);

      expect(reviewService.getUserReviews).toHaveBeenCalledWith(userId, paginationDto);
      expect(result).toEqual(mockResponse);
    });
  });
});