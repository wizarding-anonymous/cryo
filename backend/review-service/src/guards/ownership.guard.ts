import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ReviewService } from '../services/review.service';
import { AuthenticatedRequest } from './jwt-auth.guard';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly reviewService: ReviewService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const reviewId = request.params.id;
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('User authentication required');
    }

    if (!reviewId) {
      throw new ForbiddenException('Review ID is required');
    }

    try {
      // Check if the review exists and belongs to the user
      const review = await this.reviewService.findReviewById(reviewId);
      
      if (!review) {
        throw new NotFoundException('Review not found');
      }

      if (review.userId !== userId) {
        throw new ForbiddenException('You can only modify your own reviews');
      }

      return true;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('Unable to verify review ownership');
    }
  }
}