import { Injectable, Logger } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { EventType } from '../dto/update-progress.dto';
import { UserAchievementResponseDto } from '../dto';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(private readonly progressService: ProgressService) {}

  /**
   * Обработка покупки игры пользователем
   */
  async handleGamePurchase(userId: string, gameId: string): Promise<void> {
    this.logger.log(`Handling game purchase for user ${userId}, game ${gameId}`);

    try {
      const eventData = {
        gameId,
        timestamp: new Date().toISOString(),
      };

      // Обновляем прогресс пользователя
      const updatedProgress = await this.progressService.updateProgress(
        userId,
        EventType.GAME_PURCHASE,
        eventData
      );

      this.logger.log(`Updated ${updatedProgress?.length || 0} progress records for game purchase`);

      // Проверяем разблокированные достижения
      const unlockedAchievements = await this.progressService.checkAchievements(userId);
      
      // Отправляем уведомления о разблокированных достижениях
      for (const achievement of unlockedAchievements) {
        try {
          await this.notifyAchievementUnlocked(userId, achievement.achievement.id);
        } catch (error) {
          this.logger.error(`Failed to notify achievement unlock for user ${userId}, achievement ${achievement.achievement.id}:`, error);
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
        eventData
      );

      this.logger.log(`Updated ${updatedProgress?.length || 0} progress records for review creation`);

      // Проверяем разблокированные достижения
      const unlockedAchievements = await this.progressService.checkAchievements(userId);
      
      // Отправляем уведомления о разблокированных достижениях
      for (const achievement of unlockedAchievements) {
        try {
          await this.notifyAchievementUnlocked(userId, achievement.achievement.id);
        } catch (error) {
          this.logger.error(`Failed to notify achievement unlock for user ${userId}, achievement ${achievement.achievement.id}:`, error);
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
        eventData
      );

      this.logger.log(`Updated ${updatedProgress?.length || 0} progress records for friend addition`);

      // Проверяем разблокированные достижения
      const unlockedAchievements = await this.progressService.checkAchievements(userId);
      
      // Отправляем уведомления о разблокированных достижениях
      for (const achievement of unlockedAchievements) {
        try {
          await this.notifyAchievementUnlocked(userId, achievement.achievement.id);
        } catch (error) {
          this.logger.error(`Failed to notify achievement unlock for user ${userId}, achievement ${achievement.achievement.id}:`, error);
          // Продолжаем обработку других уведомлений
        }
      }

    } catch (error) {
      this.logger.error(`Failed to handle friend addition for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Уведомление о разблокировке достижения
   * В MVP версии просто логируем, в будущем будет интеграция с Notification Service
   */
  async notifyAchievementUnlocked(userId: string, achievementId: string): Promise<void> {
    this.logger.log(`Achievement ${achievementId} unlocked for user ${userId}`);

    try {
      // TODO: В будущих версиях здесь будет интеграция с Notification Service
      // Для MVP просто логируем событие
      this.logger.log(`Notification sent for achievement ${achievementId} to user ${userId}`);

      // Можно добавить метрики или другую логику уведомлений
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
    this.logger.debug(`Recording achievement unlock event: user=${userId}, achievement=${achievementId}`);
  }
}
