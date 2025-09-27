import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';

export interface FirstReviewAchievementDto {
  userId: string;
  gameId: string;
  reviewId: string;
  achievementType: 'FIRST_REVIEW';
  timestamp: string;
}

export interface AchievementResponse {
  success: boolean;
  achievementId?: string;
  message?: string;
}

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);
  private readonly achievementServiceUrl: string;
  private readonly requestTimeout: number;
  private readonly maxRetries: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.achievementServiceUrl = this.configService.get<string>(
      'ACHIEVEMENT_SERVICE_URL',
      'http://achievement-service:3000'
    );
    this.requestTimeout = this.configService.get<number>('ACHIEVEMENT_REQUEST_TIMEOUT', 5000);
    this.maxRetries = this.configService.get<number>('ACHIEVEMENT_MAX_RETRIES', 3);
  }

  async notifyFirstReview(userId: string, gameId: string, reviewId: string): Promise<boolean> {
    try {
      const payload: FirstReviewAchievementDto = {
        userId,
        gameId,
        reviewId,
        achievementType: 'FIRST_REVIEW',
        timestamp: new Date().toISOString(),
      };

      this.logger.debug(`Notifying Achievement Service about first review: ${JSON.stringify(payload)}`);

      const response = await firstValueFrom(
        this.httpService
          .post<AchievementResponse>(`${this.achievementServiceUrl}/achievements/review`, payload, {
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
                this.logger.warn(`Retry ${retryCount}/${this.maxRetries} for achievement notification after ${delay}ms:`, error.message);
                return new Promise(resolve => setTimeout(resolve, delay));
              },
            }),
            catchError((error) => {
              this.logger.error(`Achievement Service notification failed:`, error.response?.data || error.message);
              // Don't throw error - achievement notification is not critical for review creation
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
        this.logger.log(`Achievement notification sent successfully for user ${userId}, review ${reviewId}`);
      } else {
        this.logger.warn(`Achievement notification failed for user ${userId}, review ${reviewId}:`, response.data?.message);
      }

      return success;
    } catch (error) {
      this.logger.error(`Failed to notify Achievement Service for user ${userId}, review ${reviewId}:`, error);
      return false; // Don't fail review creation if achievement notification fails
    }
  }

  async checkUserFirstReview(userId: string): Promise<boolean> {
    try {
      this.logger.debug(`Checking if this is user's first review: ${userId}`);

      const response = await firstValueFrom(
        this.httpService
          .get<{ isFirstReview: boolean }>(`${this.achievementServiceUrl}/achievements/user/${userId}/first-review-status`, {
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
                this.logger.warn(`Retry ${retryCount}/${this.maxRetries} for first review check after ${delay}ms:`, error.message);
                return new Promise(resolve => setTimeout(resolve, delay));
              },
            }),
            catchError((error) => {
              this.logger.warn(`Achievement Service first review check failed:`, error.response?.data || error.message);
              // If we can't check, assume it's not the first review to avoid false positives
              return Promise.resolve({
                data: { isFirstReview: false },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any,
              });
            }),
          ),
      );

      return response.data?.isFirstReview === true;
    } catch (error) {
      this.logger.error(`Failed to check first review status for user ${userId}:`, error);
      return false; // Default to false if check fails
    }
  }

  async getServiceHealth(): Promise<{ status: 'healthy' | 'unhealthy'; achievementService: boolean }> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .get(`${this.achievementServiceUrl}/health`, { timeout: 2000 })
          .pipe(
            timeout(2000),
            catchError(() => Promise.resolve({ status: 503 })),
          ),
      );
      
      const achievementServiceHealthy = response.status === 200;
      
      return {
        status: achievementServiceHealthy ? 'healthy' : 'unhealthy',
        achievementService: achievementServiceHealthy,
      };
    } catch (error) {
      this.logger.warn('Achievement Service health check failed:', error);
      return {
        status: 'unhealthy',
        achievementService: false,
      };
    }
  }
}