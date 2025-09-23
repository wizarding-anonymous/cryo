import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { AxiosError } from 'axios';

// A basic DTO for sending a notification, based on the integration map
interface SendNotificationDto {
  userId: string;
  type: 'friend_request' | 'new_message' | 'achievement_unlocked';
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
}

@Injectable()
export class NotificationServiceClient {
  private readonly logger = new Logger(NotificationServiceClient.name);
  private readonly baseUrl =
    process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3003/api';
  private readonly defaultRetryOptions: RetryOptions = {
    attempts: 3,
    baseDelayMs: 300,
    maxDelayMs: 5000,
    timeoutMs: 8000,
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
        this.logger.debug(`Notification attempt ${attempt}/${attempts}`);

        const result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Notification request timeout')), timeoutMs!),
          ),
        ]);

        if (attempt > 1) {
          this.logger.log(`Notification sent successfully on attempt ${attempt}`);
        }

        return result;
      } catch (error) {
        lastError = error;

        // Don't retry on client errors (4xx) except for 429 (rate limit)
        if (this.isClientError(error) && !this.isRateLimitError(error)) {
          this.logger.warn(
            `Client error, not retrying notification: ${this.getErrorMessage(error)}`,
          );
          throw error;
        }

        if (attempt === attempts!) {
          this.logger.error(
            `All ${attempts} notification attempts failed. Last error: ${this.getErrorMessage(error)}`,
          );
          break;
        }

        const delay = Math.min(baseDelayMs! * Math.pow(2, attempt - 1), maxDelayMs!);
        this.logger.warn(
          `Notification attempt ${attempt} failed, retrying in ${delay}ms: ${this.getErrorMessage(error)}`,
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

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof AxiosError) {
      return error.response?.status === 429;
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

  async sendNotification(dto: SendNotificationDto): Promise<void> {
    try {
      this.logger.debug(`Sending notification to user ${dto.userId}: ${dto.type}`);

      await this.requestWithRetry(
        async () =>
          firstValueFrom(
            this.httpService.post(`${this.baseUrl}/notifications`, dto).pipe(
              timeout(6000),
              catchError((error) => {
                this.logger.error(`Failed to send notification: ${error.message}`);
                throw error;
              }),
            ),
          ),
        { timeoutMs: 6000 },
      );

      this.logger.debug(`Notification sent successfully to user ${dto.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send notification to user ${dto.userId}: ${this.getErrorMessage(error)}`,
      );
      // Don't throw error to avoid breaking the main flow
      // Notifications are not critical for core functionality
    }
  }

  /**
   * Send notification with fire-and-forget pattern
   * This method doesn't throw errors to avoid breaking main operations
   */
  async sendNotificationAsync(dto: SendNotificationDto): Promise<void> {
    // Run in background without blocking
    setImmediate(async () => {
      try {
        await this.sendNotification(dto);
      } catch (error) {
        this.logger.error(`Background notification failed: ${this.getErrorMessage(error)}`);
      }
    });
  }

  /**
   * Send multiple notifications in batch
   */
  async sendBatchNotifications(notifications: SendNotificationDto[]): Promise<void> {
    if (notifications.length === 0) {
      return;
    }

    this.logger.debug(`Sending batch of ${notifications.length} notifications`);

    try {
      await this.requestWithRetry(
        async () =>
          firstValueFrom(
            this.httpService.post(`${this.baseUrl}/notifications/batch`, { notifications }).pipe(
              timeout(10000),
              catchError((error) => {
                this.logger.error(`Failed to send batch notifications: ${error.message}`);
                throw error;
              }),
            ),
          ),
        { timeoutMs: 10000, attempts: 2 },
      );

      this.logger.debug(`Batch notifications sent successfully`);
    } catch (error) {
      this.logger.error(`Failed to send batch notifications: ${this.getErrorMessage(error)}`);
      // Fallback to individual notifications
      for (const notification of notifications) {
        await this.sendNotificationAsync(notification);
      }
    }
  }
}
