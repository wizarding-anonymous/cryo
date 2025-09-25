import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OwnershipGuard } from './ownership.guard';
import { ReviewService } from '../services/review.service';
import { Review } from '../entities/review.entity';

describe('OwnershipGuard', () => {
    let guard: OwnershipGuard;
    let reviewService: jest.Mocked<ReviewService>;
    let mockExecutionContext: Partial<ExecutionContext>;
    let mockRequest: any;

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

        mockRequest = {
            params: { id: 'review123' },
            user: { id: 'user123', email: 'test@example.com' },
        };

        mockExecutionContext = {
            switchToHttp: () => ({
                getRequest: () => mockRequest,
                getResponse: () => ({} as any),
                getNext: () => jest.fn() as any,
            }),
        };
    });

    describe('canActivate', () => {
        it('should throw ForbiddenException when user is not authenticated', async () => {
            mockRequest.user = undefined;

            await expect(
                guard.canActivate(mockExecutionContext as ExecutionContext),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should throw ForbiddenException when review ID is missing', async () => {
            mockRequest.params.id = undefined;

            await expect(
                guard.canActivate(mockExecutionContext as ExecutionContext),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should throw NotFoundException when review does not exist', async () => {
            reviewService.findReviewById.mockResolvedValue(null);

            await expect(
                guard.canActivate(mockExecutionContext as ExecutionContext),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException when user does not own the review', async () => {
            const review = {
                id: 'review123',
                userId: 'different-user',
                gameId: 'game123',
                text: 'Great game!',
                rating: 5,
            } as Review;

            reviewService.findReviewById.mockResolvedValue(review);

            await expect(
                guard.canActivate(mockExecutionContext as ExecutionContext),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should return true when user owns the review', async () => {
            const review = {
                id: 'review123',
                userId: 'user123',
                gameId: 'game123',
                text: 'Great game!',
                rating: 5,
            } as Review;

            reviewService.findReviewById.mockResolvedValue(review);

            const result = await guard.canActivate(mockExecutionContext as ExecutionContext);

            expect(result).toBe(true);
            expect(reviewService.findReviewById).toHaveBeenCalledWith('review123');
        });

        it('should throw ForbiddenException when service throws unexpected error', async () => {
            reviewService.findReviewById.mockRejectedValue(new Error('Database error'));

            await expect(
                guard.canActivate(mockExecutionContext as ExecutionContext),
            ).rejects.toThrow(ForbiddenException);
        });
    });
});