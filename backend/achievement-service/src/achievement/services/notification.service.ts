import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AchievementUnlockedNotification {
  userId: string;
  achievementId: string;
  achievementName: string;
  achievementDescription: string;
  achievementPoints: number;
  unlockedAt: string;
  notificationType: 'achievement_unlocked';
}

export interface NotificationServiceResponse {
  success: boolean;
  notificationId?: string;
  message: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly notificationServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.notificationServiceUrl = this.configService.get<string>(
      'NOTIFICATION_SERVICE_URL',
      'http://notification-service:3000'
    );
  }

  /**
   * Отправка уведомления о разблокировке достижения в Notification Service
   */
  async sendAchievementUnlockedNotification(
    notification: AchievementUnlockedNotification
  ): Promise<NotificationServiceResponse> {
    this.logger.log(`Sending achievement unlocked notification for user ${notification.userId}, achievement ${notification.achievementId}`);

    try {
      // В MVP версии используем fetch для HTTP запросов
      const response = await fetch(`${this.notificationServiceUrl}/api/notifications/achievement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'achievement-service',
          'X-Service-Version': '1.0.0',
        },
        body: JSON.stringify(notification),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Notification Service responded with ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      this.logger.log(`Achievement notification sent successfully: ${result.notificationId || 'no-id'}`);
      
      return {
        success: true,
        notificationId: result.notificationId,
        message: 'Notification sent successfully'
      };

    } catch (error) {
      this.logger.error(`Failed to send achievement notification:`, error);
      
      // В MVP не пробрасываем ошибку, чтобы не нарушить основной flow
      return {
        success: false,
        message: `Failed to send notification: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Проверка доступности Notification Service
   */
  async checkNotificationServiceHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.notificationServiceUrl}/health`, {
        method: 'GET',
        headers: {
          'X-Service-Name': 'achievement-service',
        },
      });

      return response.ok;
    } catch (error) {
      this.logger.warn(`Notification Service health check failed:`, error);
      return false;
    }
  }

  /**
   * Отправка batch уведомлений (для будущих версий)
   */
  async sendBatchNotifications(
    notifications: AchievementUnlockedNotification[]
  ): Promise<NotificationServiceResponse[]> {
    this.logger.log(`Sending batch of ${notifications.length} achievement notifications`);

    const results: NotificationServiceResponse[] = [];

    // В MVP отправляем уведомления последовательно
    // В будущих версиях можно оптимизировать через batch API
    for (const notification of notifications) {
      const result = await this.sendAchievementUnlockedNotification(notification);
      results.push(result);
    }

    return results;
  }
}