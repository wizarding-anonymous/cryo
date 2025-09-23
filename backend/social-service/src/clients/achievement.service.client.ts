import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { AxiosError } from 'axios';

interface UpdateProgressDto {
  userId: string;
  eventType: 'friend_added' | 'message_sent' | 'social_interaction'; // Extended event types
  eventData: {
    friendId?: string;
    messageId?: string;
    interactionType?: string;
  };
}

interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
}

@Injectable()
export class AchievementServiceClient {
  private readonly logger = new Logger(AchievementServiceClient.name);
  private readonly baseUrl =
    process.env.ACHIEVEMENT_SERVICE_URL || 'http://achievement-service:3003/api';
  private readonly defaultRetryOptions: RetryOptions = {
    attempts: 2, // Fewer retries for achievements as they're not critical
    baseDelayMs: 500,
    maxDelayMs: 3000,
    timeoutMs: 5000,
  };

  constructor(private readonly httpService: HttpService) {}

  private async requestWithRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const { attempts, baseDelayMs, maxDelayMs, timeoutMs } = {
      ...this.defaultRetryOptions,
      ...options,
    };

    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts!; attempt++) {
      try {
        this.logger.debug(`Achievement update attempt ${attempt}/${attempts}`);

        const result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Achievement request timeout')), timeoutMs!),
          ),
        ]);

        if (attempt > 1) {
          this.logger.log(`Achievement update succeeded on attempt ${attempt}`);
        }

        return result;
      } catch (error) {
        lastError = error;

        // Don't retry on client errors (4xx)
        if (this.isClientError(error)) {
          this.logger.warn(
            `Client error, not retrying achievement update: ${this.getErrorMessage(error)}`,
          );
          throw error;
        }

        if (attempt === attempts!) {
          this.logger.error(
            `All ${attempts} achievement update attempts failed. Last error: ${this.getErrorMessage(error)}`,
          );
          break;
        }

        const delay = Math.min(baseDelayMs! * Math.pow(2, attempt - 1), maxDelayMs!);
        this.logger.warn(
          `Achievement update attempt ${attempt} failed, retrying in ${delay}ms: ${this.getErrorMessage(error)}`,
        );

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private isClientError(error: unknown): boolean {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      return typeof status === 'number' && status >= 400 && status < 500;
    }
    return false;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async updateProgress(dto: UpdateProgressDto): Promise<void> {
    try {
      this.logger.debug(`Updating achievement progress for user ${dto.userId}: ${dto.eventType}`);

      await this.requestWithRetry(
        async () =>
          firstValueFrom(
            this.httpService.post(`${this.baseUrl}/achievements/progress/update`, dto).pipe(
              timeout(4000),
              catchError((error) => {
                this.logger.error(`Failed to update achievement progress: ${error.message}`);
                throw error;
              }),
            ),
          ),
        { timeoutMs: 4000 },
      );

      this.logger.debug(`Achievement progress updated successfully for user ${dto.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to update achievement progress for user ${dto.userId}: ${this.getErrorMessage(error)}`,
      );
      // Don't throw error to avoid breaking the main flow
      // Achievements are not critical for core functionality
    }
  }

  /**
   * Update achievement progress with fire-and-forget pattern
   */
  async updateProgressAsync(dto: UpdateProgressDto): Promise<void> {
    // Run in background without blocking
    setImmediate(async () => {
      try {
        await this.updateProgress(dto);
      } catch (error) {
        this.logger.error(`Background achievement update failed: ${this.getErrorMessage(error)}`);
      }
    });
  }

  /**
   * Get user achievements (for social features)
   */
  async getUserAchievements(userId: string): Promise<any[]> {
    try {
      this.logger.debug(`Fetching achievements for user ${userId}`);

      const response = await this.requestWithRetry(
        async () =>
          firstValueFrom(
            this.httpService.get(`${this.baseUrl}/achievements/user/${userId}`).pipe(
              timeout(3000),
              catchError((error) => {
                this.logger.error(`Failed to get user achievements: ${error.message}`);
                throw error;
              }),
            ),
          ),
        { timeoutMs: 3000, attempts: 1 },
      );

      return response.data?.achievements || [];
    } catch (error) {
      this.logger.error(
        `Failed to get achievements for user ${userId}: ${this.getErrorMessage(error)}`,
      );
      return [];
    }
  }
}
