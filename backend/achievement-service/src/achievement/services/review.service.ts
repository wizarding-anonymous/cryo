import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface UserReview {
  reviewId: string;
  userId: string;
  gameId: string;
  rating: number;
  content?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  firstReviewDate?: string;
  lastReviewDate?: string;
  reviewsByRating: {
    [rating: number]: number;
  };
}

export interface ReviewServiceResponse<T> {
  success: boolean;
  data?: T;
  message: string;
}

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);
  private readonly reviewServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.reviewServiceUrl = this.configService.get<string>(
      'REVIEW_SERVICE_URL',
      'http://review-service:3000',
    );
  }

  /**
   * Получение отзыва по ID
   */
  async getReview(reviewId: string): Promise<UserReview | null> {
    this.logger.log(`Getting review ${reviewId}`);

    try {
      const response = await fetch(`${this.reviewServiceUrl}/api/reviews/${reviewId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'achievement-service',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Review Service responded with ${response.status}`);
      }

      const result = await response.json();
      return result.review || null;
    } catch (error) {
      this.logger.error(`Failed to get review ${reviewId}:`, error);
      return null;
    }
  }

  /**
   * Получение отзывов пользователя
   */
  async getUserReviews(userId: string, limit = 50, offset = 0): Promise<UserReview[]> {
    this.logger.log(`Getting reviews for user ${userId} (limit: ${limit}, offset: ${offset})`);

    try {
      const response = await fetch(
        `${this.reviewServiceUrl}/api/users/${userId}/reviews?limit=${limit}&offset=${offset}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Review Service responded with ${response.status}`);
      }

      const result = await response.json();
      return result.reviews || [];
    } catch (error) {
      this.logger.error(`Failed to get reviews for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Получение статистики отзывов пользователя
   */
  async getUserReviewStats(userId: string): Promise<ReviewStats | null> {
    this.logger.log(`Getting review stats for user ${userId}`);

    try {
      const response = await fetch(`${this.reviewServiceUrl}/api/users/${userId}/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'achievement-service',
        },
      });

      if (!response.ok) {
        throw new Error(`Review Service responded with ${response.status}`);
      }

      const result = await response.json();
      return result.stats || null;
    } catch (error) {
      this.logger.error(`Failed to get review stats for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Получение количества отзывов пользователя
   */
  async getUserReviewCount(userId: string): Promise<number> {
    this.logger.log(`Getting review count for user ${userId}`);

    try {
      const response = await fetch(`${this.reviewServiceUrl}/api/users/${userId}/count`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'achievement-service',
        },
      });

      if (!response.ok) {
        throw new Error(`Review Service responded with ${response.status}`);
      }

      const result = await response.json();
      const reviewCount = result.count || 0;

      this.logger.log(`User ${userId} has ${reviewCount} reviews`);
      return reviewCount;
    } catch (error) {
      this.logger.error(`Failed to get review count for user ${userId}:`, error);
      // Возвращаем 0 в случае ошибки, чтобы не нарушить логику достижений
      return 0;
    }
  }

  /**
   * Проверка существования отзыва
   */
  async reviewExists(reviewId: string): Promise<boolean> {
    const review = await this.getReview(reviewId);
    return review !== null;
  }

  /**
   * Получение отзывов пользователя по игре
   */
  async getUserReviewsForGame(userId: string, gameId: string): Promise<UserReview[]> {
    this.logger.log(`Getting reviews for user ${userId} and game ${gameId}`);

    try {
      const response = await fetch(
        `${this.reviewServiceUrl}/api/users/${userId}/games/${gameId}/reviews`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Review Service responded with ${response.status}`);
      }

      const result = await response.json();
      return result.reviews || [];
    } catch (error) {
      this.logger.error(`Failed to get reviews for user ${userId} and game ${gameId}:`, error);
      return [];
    }
  }

  /**
   * Проверка доступности Review Service
   */
  async checkReviewServiceHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.reviewServiceUrl}/health`, {
        method: 'GET',
        headers: {
          'X-Service-Name': 'achievement-service',
        },
      });

      return response.ok;
    } catch (error) {
      this.logger.warn(`Review Service health check failed:`, error);
      return false;
    }
  }

  /**
   * Получение информации о первом отзыве пользователя
   */
  async getFirstReviewInfo(userId: string): Promise<{ reviewId: string; createdAt: string } | null> {
    this.logger.log(`Getting first review info for user ${userId}`);

    try {
      const stats = await this.getUserReviewStats(userId);
      if (!stats || !stats.firstReviewDate) {
        return null;
      }

      // Получаем первый отзыв из списка (отсортированного по дате создания)
      const reviews = await this.getUserReviews(userId, 1, 0);
      if (reviews.length === 0) {
        return null;
      }

      return {
        reviewId: reviews[0].reviewId,
        createdAt: stats.firstReviewDate,
      };
    } catch (error) {
      this.logger.error(`Failed to get first review info for user ${userId}:`, error);
      return null;
    }
  }
}