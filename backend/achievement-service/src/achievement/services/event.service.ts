import { Injectable, Logger } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { NotificationService, AchievementUnlockedNotification } from './notification.service';
import { LibraryService } from './library.service';
import { EventType } from '../dto/update-progress.dto';
import { UserAchievementResponseDto } from '../dto';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(
    private readonly progressService: ProgressService,
    private readonly notificationService: NotificationService,
    private readonly libraryService: LibraryService,
  ) {}

  /**
   * Обработка покупки игры пользователем
   */
  async handleGamePurchase(userId: string, gameId: string): Promise<void> {
    this.logger.log(`Handling game purchase for user ${userId}, game ${gameId}`);

    try {
      // Получаем дополнительную информацию из Library Service
      const gameCount = await this.libraryService.getUserGameCount(userId);
      const isFirstPurchase = gameCount <= 1;

      const eventData = {
        gameId,
        timestamp: new Date().toISOString(),
        gameCount,
        isFirstPurchase,
      };

      // Обновляем прогресс пользователя
      const updatedProgress = await this.progressService.updateProgress(
        userId,
        EventType.GAME_PURCHASE,
        eventData,
      );

      this.logger.log(
        `Updated ${updatedProgress?.length || 0} progress records for game purchase (total games: ${gameCount})`,
      );

      // Проверяем разблокированные достижения
      const unlockedAchievements = await this.progressService.checkAchievements(userId);

      // Отправляем уведомления о разблокированных достижениях
      for (const achievement of unlockedAchievements) {
        try {
          await this.notifyAchievementUnlocked(userId, achievement.achievement.id);
        } catch (error) {
          this.logger.error(
            `Failed to notify achievement unlock for user ${userId}, achievement ${achievement.achievement.id}:`,
            error,
          );
          // Продолжаем обработку других уведомлений
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle game purchase for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Обработка создания отзыва пользователем
   */
  async handleReviewCreated(userId: string, reviewId: string): Promise<void> {
    this.logger.log(`Handling review creation for user ${userId}, review ${reviewId}`);

    try {
      const eventData = {
        reviewId,
        timestamp: new Date().toISOString(),
      };

      // Обновляем прогресс пользователя
      const updatedProgress = await this.progressService.updateProgress(
        userId,
        EventType.REVIEW_CREATED,
        eventData,
      );

      this.logger.log(
        `Updated ${updatedProgress?.length || 0} progress records for review creation`,
      );

      // Проверяем разблокированные достижения
      const unlockedAchievements = await this.progressService.checkAchievements(userId);

      // Отправляем уведомления о разблокированных достижениях
      for (const achievement of unlockedAchievements) {
        try {
          await this.notifyAchievementUnlocked(userId, achievement.achievement.id);
        } catch (error) {
          this.logger.error(
            `Failed to notify achievement unlock for user ${userId}, achievement ${achievement.achievement.id}:`,
            error,
          );
          // Продолжаем обработку других уведомлений
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle review creation for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Обработка добавления друга пользователем
   */
  async handleFriendAdded(userId: string, friendId: string): Promise<void> {
    this.logger.log(`Handling friend addition for user ${userId}, friend ${friendId}`);

    try {
      const eventData = {
        friendId,
        timestamp: new Date().toISOString(),
      };

      // Обновляем прогресс пользователя
      const updatedProgress = await this.progressService.updateProgress(
        userId,
        EventType.FRIEND_ADDED,
        eventData,
      );

      this.logger.log(
        `Updated ${updatedProgress?.length || 0} progress records for friend addition`,
      );

      // Проверяем разблокированные достижения
      const unlockedAchievements = await this.progressService.checkAchievements(userId);

      // Отправляем уведомления о разблокированных достижениях
      for (const achievement of unlockedAchievements) {
        try {
          await this.notifyAchievementUnlocked(userId, achievement.achievement.id);
        } catch (error) {
          this.logger.error(
            `Failed to notify achievement unlock for user ${userId}, achievement ${achievement.achievement.id}:`,
            error,
          );
          // Продолжаем обработку других уведомлений
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle friend addition for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Уведомление о разблокировке достижения через Notification Service
   */
  async notifyAchievementUnlocked(userId: string, achievementId: string): Promise<void> {
    this.logger.log(`Achievement ${achievementId} unlocked for user ${userId}`);

    try {
      // Получаем информацию о достижении для уведомления
      const achievement = await this.progressService.getAchievementById(achievementId);
      if (!achievement) {
        this.logger.error(`Achievement ${achievementId} not found for notification`);
        return;
      }

      // Формируем уведомление
      const notification: AchievementUnlockedNotification = {
        userId,
        achievementId,
        achievementName: achievement.name,
        achievementDescription: achievement.description,
        achievementPoints: achievement.points,
        unlockedAt: new Date().toISOString(),
        notificationType: 'achievement_unlocked',
      };

      // Отправляем уведомление в Notification Service
      const result =
        await this.notificationService.sendAchievementUnlockedNotification(notification);

      if (result.success) {
        this.logger.log(
          `Notification sent successfully for achievement ${achievementId} to user ${userId}`,
        );
      } else {
        this.logger.warn(`Failed to send notification: ${result.message}`);
      }

      // Записываем событие для метрик
      await this.recordAchievementUnlockEvent(userId, achievementId);
    } catch (error) {
      this.logger.error(`Failed to notify achievement unlock for user ${userId}:`, error);
      // Не пробрасываем ошибку, чтобы не нарушить основной flow
    }
  }

  /**
   * Запись события разблокировки достижения для метрик
   */
  private async recordAchievementUnlockEvent(userId: string, achievementId: string): Promise<void> {
    // В будущем здесь может быть отправка метрик в систему мониторинга
    this.logger.debug(
      `Recording achievement unlock event: user=${userId}, achievement=${achievementId}`,
    );
  }
}
