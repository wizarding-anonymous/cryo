import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';
import { Review } from '../entities/review.entity';

export interface NewReviewNotificationDto {
  type: 'NEW_REVIEW';
  userId: string;
  gameId: string;
  reviewId: string;
  rating: number;
  reviewText: string;
  timestamp: string;
  metadata?: {
    gameName?: string;
    userName?: string;
  };
}

export interface NotificationResponse {
  success: boolean;
  notificationId?: string;
  message?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly notificationServiceUrl: string;
  private readonly requestTimeout: number;
  private readonly maxRetries: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.notificationServiceUrl = this.configService.get<string>(
      'NOTIFICATION_SERVICE_URL',
      'http://notification-service:3000'
    );
    this.requestTimeout = this.configService.get<number>('NOTIFICATION_REQUEST_TIMEOUT', 5000);
    this.maxRetries = this.configService.get<number>('NOTIFICATION_MAX_RETRIES', 3);
  }

  async notifyNewReview(review: Review, gameName?: string, userName?: string): Promise<boolean> {
    try {
      const payload: NewReviewNotificationDto = {
        type: 'NEW_REVIEW',
        userId: review.userId,
        gameId: review.gameId,
        reviewId: review.id,
        rating: review.rating,
        reviewText: review.text,
        timestamp: review.createdAt.toISOString(),
        metadata: {
          gameName,
          userName,
        },
      };

      this.logger.debug(`Notifying about new review: ${JSON.stringify(payload)}`);

      const response = await firstValueFrom(
        this.httpService
          .post<NotificationResponse>(`${this.notificationServiceUrl}/notifications/review`, payload, {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'review-service/1.0',
            },
          })
          .pipe(
            timeout(this.requestTimeout),
            retry({
              count: this.maxRetries,
              delay: (error, retryCount) => {
                const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
                this.logger.warn(`Retry ${retryCount}/${this.maxRetries} for notification after ${delay}ms:`, error.message);
                return new Promise(resolve => setTimeout(resolve, delay));
              },
            }),
            catchError((error) => {
              this.logger.error(`Notification Service failed:`, error.response?.data || error.message);
              // Don't throw error - notification is not critical for review creation
              return Promise.resolve({
                data: { success: false, message: 'Service unavailable' },
                status: 503,
                statusText: 'Service Unavailable',
                headers: {},
                config: {} as any,
              });
            }),
          ),
      );

      const success = response.data?.success === true;
      if (success) {
        this.logger.log(`New review notification sent successfully for review ${review.id}`);
      } else {
        this.logger.warn(`New review notification failed for review ${review.id}:`, response.data?.message);
      }

      return success;
    } catch (error) {
      this.logger.error(`Failed to notify about new review ${review.id}:`, error);
      return false; // Don't fail review creation if notification fails
    }
  }

  async notifyReviewUpdate(review: Review, gameName?: string, userName?: string): Promise<boolean> {
    try {
      const payload = {
        type: 'REVIEW_UPDATED',
        userId: review.userId,
        gameId: review.gameId,
        reviewId: review.id,
        rating: review.rating,
        reviewText: review.text,
        timestamp: review.updatedAt.toISOString(),
        metadata: {
          gameName,
          userName,
        },
      };

      this.logger.debug(`Notifying about review update: ${JSON.stringify(payload)}`);

      const response = await firstValueFrom(
        this.httpService
          .post<NotificationResponse>(`${this.notificationServiceUrl}/notifications/review-update`, payload, {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'review-service/1.0',
            },
          })
          .pipe(
            timeout(this.requestTimeout),
            retry({
              count: this.maxRetries,
              delay: (error, retryCount) => {
                const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
                this.logger.warn(`Retry ${retryCount}/${this.maxRetries} for update notification after ${delay}ms:`, error.message);
                return new Promise(resolve => setTimeout(resolve, delay));
              },
            }),
            catchError((error) => {
              this.logger.error(`Notification Service update failed:`, error.response?.data || error.message);
              return Promise.resolve({
                data: { success: false, message: 'Service unavailable' },
                status: 503,
                statusText: 'Service Unavailable',
                headers: {},
                config: {} as any,
              });
            }),
          ),
      );

      const success = response.data?.success === true;
      if (success) {
        this.logger.log(`Review update notification sent successfully for review ${review.id}`);
      } else {
        this.logger.warn(`Review update notification failed for review ${review.id}:`, response.data?.message);
      }

      return success;
    } catch (error) {
      this.logger.error(`Failed to notify about review update ${review.id}:`, error);
      return false;
    }
  }

  async getServiceHealth(): Promise<{ status: 'healthy' | 'unhealthy'; notificationService: boolean }> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .get(`${this.notificationServiceUrl}/health`, { timeout: 2000 })
          .pipe(
            timeout(2000),
            catchError(() => Promise.resolve({ status: 503 })),
          ),
      );
      
      const notificationServiceHealthy = response.status === 200;
      
      return {
        status: notificationServiceHealthy ? 'healthy' : 'unhealthy',
        notificationService: notificationServiceHealthy,
      };
    } catch (error) {
      this.logger.warn('Notification Service health check failed:', error);
      return {
        status: 'unhealthy',
        notificationService: false,
      };
    }
  }
}