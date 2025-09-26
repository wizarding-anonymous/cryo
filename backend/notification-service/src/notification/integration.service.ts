import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  PaymentEventDto,
  SocialEventDto,
  AchievementEventDto,
  ReviewEventDto,
  GameCatalogEventDto,
  LibraryEventDto,
} from './dto';

/**
 * Integration service for sending notifications from other microservices
 * This demonstrates how other services can integrate with the notification service
 */
@Injectable()
export class NotificationIntegrationService {
  private readonly logger = new Logger(NotificationIntegrationService.name);
  private readonly notificationServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.notificationServiceUrl =
      this.configService.get<string>('NOTIFICATION_SERVICE_URL') ||
      'http://localhost:3003/api/notifications';
  }

  /**
   * Send payment event notification
   */
  async sendPaymentNotification(event: PaymentEventDto): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.notificationServiceUrl}/webhook/payment`,
          event,
        ),
      );
      this.logger.log(`Payment notification sent for user ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send payment notification for user ${event.userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send social event notification
   */
  async sendSocialNotification(event: SocialEventDto): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.notificationServiceUrl}/webhook/social`,
          event,
        ),
      );
      this.logger.log(`Social notification sent for user ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send social notification for user ${event.userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send achievement event notification
   */
  async sendAchievementNotification(event: AchievementEventDto): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.notificationServiceUrl}/webhook/achievement`,
          event,
        ),
      );
      this.logger.log(`Achievement notification sent for user ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send achievement notification for user ${event.userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send review event notification
   */
  async sendReviewNotification(event: ReviewEventDto): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.notificationServiceUrl}/webhook/review`,
          event,
        ),
      );
      this.logger.log(`Review notification sent for user ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send review notification for user ${event.userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send game catalog event notification
   */
  async sendGameCatalogNotification(event: GameCatalogEventDto): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.notificationServiceUrl}/webhook/game-catalog`,
          event,
        ),
      );
      this.logger.log(
        `Game catalog notification sent for user ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send game catalog notification for user ${event.userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send library event notification
   */
  async sendLibraryNotification(event: LibraryEventDto): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.notificationServiceUrl}/webhook/library`,
          event,
        ),
      );
      this.logger.log(`Library notification sent for user ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send library notification for user ${event.userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Helper method to send game update notification
   */
  async notifyGameUpdate(
    userId: string,
    gameId: string,
    gameName: string,
    version: string,
    updateType: 'patch' | 'content' | 'hotfix' = 'patch',
  ): Promise<void> {
    const event: GameCatalogEventDto = {
      eventType: 'game.updated',
      userId,
      data: {
        gameId,
        gameName,
        updateType,
        version,
      },
    };

    await this.sendGameCatalogNotification(event);
  }

  /**
   * Helper method to send game sale notification
   */
  async notifyGameSale(
    userId: string,
    gameId: string,
    gameName: string,
    saleDiscount: number,
  ): Promise<void> {
    const event: GameCatalogEventDto = {
      eventType: 'game.sale_started',
      userId,
      data: {
        gameId,
        gameName,
        saleDiscount,
      },
    };

    await this.sendGameCatalogNotification(event);
  }

  /**
   * Helper method to send library game added notification
   */
  async notifyGameAddedToLibrary(
    userId: string,
    gameId: string,
    gameName: string,
  ): Promise<void> {
    const event: LibraryEventDto = {
      eventType: 'library.game_added',
      userId,
      data: {
        gameId,
        gameName,
        addedAt: new Date().toISOString(),
      },
    };

    await this.sendLibraryNotification(event);
  }

  /**
   * Helper method to send library game removed notification
   */
  async notifyGameRemovedFromLibrary(
    userId: string,
    gameId: string,
    gameName: string,
  ): Promise<void> {
    const event: LibraryEventDto = {
      eventType: 'library.game_removed',
      userId,
      data: {
        gameId,
        gameName,
        removedAt: new Date().toISOString(),
      },
    };

    await this.sendLibraryNotification(event);
  }

  /**
   * Helper method to send payment completion notification
   */
  async notifyPaymentCompleted(
    userId: string,
    paymentId: string,
    gameId: string,
    gameName: string,
    amount: number,
    currency: string = 'RUB',
  ): Promise<void> {
    const event: PaymentEventDto = {
      eventType: 'payment.completed',
      userId,
      data: {
        paymentId,
        gameId,
        gameName,
        amount,
        currency,
      },
    };

    await this.sendPaymentNotification(event);
  }

  /**
   * Helper method to send friend request notification
   */
  async notifyFriendRequest(
    userId: string,
    fromUserId: string,
    fromUserName: string,
  ): Promise<void> {
    const event: SocialEventDto = {
      eventType: 'friend.request',
      userId,
      data: {
        fromUserId,
        fromUserName,
      },
    };

    await this.sendSocialNotification(event);
  }

  /**
   * Helper method to send achievement unlocked notification
   */
  async notifyAchievementUnlocked(
    userId: string,
    achievementId: string,
    achievementName: string,
    achievementDescription: string,
    gameId: string,
    gameName: string,
  ): Promise<void> {
    const event: AchievementEventDto = {
      eventType: 'achievement.unlocked',
      userId,
      data: {
        achievementId,
        achievementName,
        achievementDescription,
        gameId,
        gameName,
      },
    };

    await this.sendAchievementNotification(event);
  }
}
