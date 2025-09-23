import { Test, TestingModule } from '@nestjs/testing';
import { ReviewController } from './review.controller';
import { ReviewService } from '../services/review.service';
import { CreateReviewDto, UpdateReviewDto, PaginationDto } from '../dto';

describe('ReviewController', () => {
  let controller: ReviewController;
  let reviewService: ReviewService;

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

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createReview', () => {
    it('should create a review', async () => {
      const createReviewDto: CreateReviewDto = {
        gameId: 'game-123',
        text: 'Great game!',
        rating: 5,
      };
      const mockRequest = { user: { id: 'user-123' } };
      const expectedResult = { id: 'review-123', ...createReviewDto, userId: 'user-123' };

      mockReviewService.createReview.mockResolvedValue(expectedResult);

      const result = await controller.createReview(mockRequest, createReviewDto);

      expect(reviewService.createReview).toHaveBeenCalledWith('user-123', createReviewDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getGameReviews', () => {
    it('should get game reviews with pagination', async () => {
      const gameId = 'game-123';
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const expectedResult = {
        data: [{ id: 'review-123', gameId, text: 'Great game!', rating: 5 }],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockReviewService.getGameReviews.mockResolvedValue(expectedResult);

      const result = await controller.getGameReviews(gameId, paginationDto);

      expect(reviewService.getGameReviews).toHaveBeenCalledWith(gameId, paginationDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('updateReview', () => {
    it('should update a review', async () => {
      const reviewId = 'review-123';
      const updateReviewDto: UpdateReviewDto = { text: 'Updated review text', rating: 4 };
      const mockRequest = { user: { id: 'user-123' } };
      const expectedResult = { id: reviewId, ...updateReviewDto, userId: 'user-123' };

      mockReviewService.updateReview.mockResolvedValue(expectedResult);

      const result = await controller.updateReview(reviewId, mockRequest, updateReviewDto);

      expect(reviewService.updateReview).toHaveBeenCalledWith(reviewId, 'user-123', updateReviewDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('deleteReview', () => {
    it('should delete a review', async () => {
      const reviewId = 'review-123';
      const mockRequest = { user: { id: 'user-123' } };
      const expectedResult = { message: 'Review deleted successfully' };

      mockReviewService.deleteReview.mockResolvedValue(expectedResult);

      const result = await controller.deleteReview(reviewId, mockRequest);

      expect(reviewService.deleteReview).toHaveBeenCalledWith(reviewId, 'user-123');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getUserReviews', () => {
    it('should get user reviews with pagination', async () => {
      const userId = 'user-123';
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const expectedResult = {
        data: [{ id: 'review-123', userId, text: 'Great game!', rating: 5 }],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      mockReviewService.getUserReviews.mockResolvedValue(expectedResult);

      const result = await controller.getUserReviews(userId, paginationDto);

      expect(reviewService.getUserReviews).toHaveBeenCalledWith(userId, paginationDto);
      expect(result).toEqual(expectedResult);
    });
  });
});