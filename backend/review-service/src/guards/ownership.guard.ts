import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { ReviewService } from '../services/review.service';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly reviewService: ReviewService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    const reviewId = request.params.id;

    if (!user || !user.id) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!reviewId) {
      throw new ForbiddenException('Review ID is required');
    }

    try {
      // Получаем отзыв для проверки владения
      const review = await this.reviewService.findReviewById(reviewId);
      
      if (!review) {
        throw new NotFoundException('Review not found');
      }

      // Проверяем, что пользователь является автором отзыва
      if (review.userId !== user.id) {
        throw new ForbiddenException('You can only modify your own reviews');
      }

      return true;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      
      // Для других ошибок возвращаем общую ошибку доступа
      throw new ForbiddenException('Access denied');
    }
  }
}