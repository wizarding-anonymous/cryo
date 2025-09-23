import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OwnershipGuard } from './ownership.guard';
import { ReviewService } from '../services/review.service';
import { Review } from '../entities/review.entity';

describe('OwnershipGuard', () => {
  let guard: OwnershipGuard;
  let reviewService: jest.Mocked<ReviewService>;

  const mockReview: Review = {
    id: 'review-id',
    userId: 'user-id',
    gameId: 'game-id',
    text: 'Test review',
    rating: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockReviewService = {
      findReviewById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnershipGuard,
        {
          provide: ReviewService,
          useValue: mockReviewService,
        },
      ],
    }).compile();

    guard = module.get<OwnershipGuard>(OwnershipGuard);
    reviewService = module.get(ReviewService);
  });

  const createMockExecutionContext = (user: any, reviewId: string): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params: { id: reviewId },
        }),
      }),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should allow access when user owns the review', async () => {
      const user = { id: 'user-id' };
      const context = createMockExecutionContext(user, 'review-id');
      
      reviewService.findReviewById.mockResolvedValue(mockReview);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(reviewService.findReviewById).toHaveBeenCalledWith('review-id');
    });

    it('should throw ForbiddenException when user is not authenticated', async () => {
      const context = createMockExecutionContext(null, 'review-id');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('User not authenticated'),
      );
    });

    it('should throw ForbiddenException when user id is missing', async () => {
      const user = {};
      const context = createMockExecutionContext(user, 'review-id');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('User not authenticated'),
      );
    });

    it('should throw ForbiddenException when review id is missing', async () => {
      const user = { id: 'user-id' };
      const context = createMockExecutionContext(user, '');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Review ID is required'),
      );
    });

    it('should throw NotFoundException when review does not exist', async () => {
      const user = { id: 'user-id' };
      const context = createMockExecutionContext(user, 'review-id');
      
      reviewService.findReviewById.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new NotFoundException('Review not found'),
      );
    });

    it('should throw ForbiddenException when user does not own the review', async () => {
      const user = { id: 'different-user-id' };
      const context = createMockExecutionContext(user, 'review-id');
      
      reviewService.findReviewById.mockResolvedValue(mockReview);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('You can only modify your own reviews'),
      );
    });

    it('should throw ForbiddenException when service throws unexpected error', async () => {
      const user = { id: 'user-id' };
      const context = createMockExecutionContext(user, 'review-id');
      
      reviewService.findReviewById.mockRejectedValue(new Error('Database error'));

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Access denied'),
      );
    });

    it('should re-throw NotFoundException from service', async () => {
      const user = { id: 'user-id' };
      const context = createMockExecutionContext(user, 'review-id');
      
      const notFoundError = new NotFoundException('Review not found');
      reviewService.findReviewById.mockRejectedValue(notFoundError);

      await expect(guard.canActivate(context)).rejects.toThrow(notFoundError);
    });

    it('should re-throw ForbiddenException from service', async () => {
      const user = { id: 'user-id' };
      const context = createMockExecutionContext(user, 'review-id');
      
      const forbiddenError = new ForbiddenException('Custom forbidden error');
      reviewService.findReviewById.mockRejectedValue(forbiddenError);

      await expect(guard.canActivate(context)).rejects.toThrow(forbiddenError);
    });
  });
});