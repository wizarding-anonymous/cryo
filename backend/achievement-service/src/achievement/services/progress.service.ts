import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProgress, Achievement } from '../entities';
import { AchievementService } from './achievement.service';
import { UserProgressResponseDto, UserAchievementResponseDto } from '../dto';
import { EventType } from '../dto/update-progress.dto';
import { AchievementType, AchievementCondition } from '../entities/achievement.entity';

interface UserStats {
  gamesPurchased: number;
  reviewsWritten: number;
  friendsAdded: number;
  firstPurchaseDate?: Date;
  firstReviewDate?: Date;
  firstFriendDate?: Date;
}

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  constructor(
    @InjectRepository(UserProgress)
    private readonly progressRepository: Repository<UserProgress>,
    @InjectRepository(Achievement)
    private readonly achievementRepository: Repository<Achievement>,
    private readonly achievementService: AchievementService,
  ) { }

  /**
   * Обновить прогресс пользователя с обработкой различных типов событий
   */
  async updateProgress(userId: string, eventType: string, data: any): Promise<UserProgressResponseDto[]> {
    this.logger.log(`Updating progress for user ${userId}, event: ${eventType}`);

    try {
      // Получаем все активные достижения
      const achievements = await this.achievementRepository.find({
        where: { isActive: true },
      });

      // Получаем текущую статистику пользователя
      const userStats = await this.getUserStats(userId, eventType, data);

      const updatedProgress: UserProgress[] = [];

      // Обрабатываем каждое достижение
      for (const achievement of achievements) {
        // Проверяем, подходит ли событие для этого достижения
        if (this.isEventRelevantForAchievement(eventType as EventType, achievement.type)) {
          const progress = await this.updateAchievementProgress(userId, achievement, userStats);
          if (progress) {
            updatedProgress.push(progress);
          }
        }
      }

      // Проверяем, можно ли разблокировать достижения
      await this.checkAchievements(userId);

      // Возвращаем только обновленный прогресс
      return updatedProgress.map(progress => new UserProgressResponseDto({
        id: progress.id,
        userId: progress.userId,
        achievementId: progress.achievementId,
        achievement: {
          id: progress.achievement?.id || progress.achievementId,
          name: progress.achievement?.name || '',
          description: progress.achievement?.description || '',
          type: progress.achievement?.type || AchievementType.FIRST_PURCHASE,
          iconUrl: progress.achievement?.iconUrl || '',
          points: progress.achievement?.points || 0,
          condition: progress.achievement?.condition || { type: 'first_time', field: 'gamesPurchased' },
          isActive: progress.achievement?.isActive || true,
          createdAt: progress.achievement?.createdAt || new Date(),
          updatedAt: progress.achievement?.updatedAt || new Date(),
        },
        currentValue: progress.currentValue,
        targetValue: progress.targetValue,
        updatedAt: progress.updatedAt,
      }));
    } catch (error) {
      this.logger.error(`Failed to update progress for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Получить прогресс пользователя с сортировкой по updatedAt
   */
  async getUserProgress(userId: string): Promise<UserProgressResponseDto[]> {
    this.logger.log(`Getting progress for user ${userId}`);

    const progressRecords = await this.progressRepository.find({
      where: { userId },
      relations: ['achievement'],
      order: { updatedAt: 'DESC' },
    });

    return progressRecords.map(progress => new UserProgressResponseDto({
      id: progress.id,
      userId: progress.userId,
      achievementId: progress.achievementId,
      achievement: {
        id: progress.achievement.id,
        name: progress.achievement.name,
        description: progress.achievement.description,
        type: progress.achievement.type,
        iconUrl: progress.achievement.iconUrl,
        points: progress.achievement.points,
        condition: progress.achievement.condition,
        isActive: progress.achievement.isActive,
        createdAt: progress.achievement.createdAt,
        updatedAt: progress.achievement.updatedAt,
      },
      currentValue: progress.currentValue,
      targetValue: progress.targetValue,
      updatedAt: progress.updatedAt,
    }));
  }

  /**
   * Автоматическая проверка условий достижений
   */
  async checkAchievements(userId: string): Promise<UserAchievementResponseDto[]> {
    this.logger.log(`Checking achievements for user ${userId}`);

    const unlockedAchievements: UserAchievementResponseDto[] = [];

    try {
      // Получаем все прогрессы пользователя
      const progressRecords = await this.progressRepository.find({
        where: { userId },
        relations: ['achievement'],
      });

      // Получаем статистику пользователя
      const userStats = await this.getUserStats(userId);

      for (const progress of progressRecords) {
        // Проверяем, не разблокировано ли уже достижение
        const isUnlocked = await this.achievementService.isAchievementUnlocked(userId, progress.achievementId);
        if (isUnlocked) {
          continue;
        }

        // Проверяем условие достижения
        const conditionMet = await this.evaluateCondition(progress.achievement.condition, userStats);

        if (conditionMet) {
          try {
            const unlockedAchievement = await this.achievementService.unlockAchievement(userId, progress.achievementId);
            unlockedAchievements.push(unlockedAchievement);
            this.logger.log(`Achievement ${progress.achievement.name} unlocked for user ${userId}`);
          } catch (error) {
            // Игнорируем ошибки разблокировки (например, если уже разблокировано)
            this.logger.warn(`Failed to unlock achievement ${progress.achievementId} for user ${userId}:`, error);
          }
        }
      }

      return unlockedAchievements;
    } catch (error) {
      this.logger.error(`Failed to check achievements for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Обработка различных типов условий достижений
   */
  private async evaluateCondition(condition: AchievementCondition, userStats: UserStats): Promise<boolean> {
    switch (condition.type) {
      case 'first_time':
        return this.evaluateFirstTimeCondition(condition, userStats);

      case 'count':
        return this.evaluateCountCondition(condition, userStats);

      case 'threshold':
        return this.evaluateThresholdCondition(condition, userStats);

      default:
        this.logger.warn(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  /**
   * Проверка условия "первый раз"
   */
  private evaluateFirstTimeCondition(condition: AchievementCondition, userStats: UserStats): boolean {
    switch (condition.field) {
      case 'gamesPurchased':
        return userStats.gamesPurchased >= 1;
      case 'reviewsWritten':
        return userStats.reviewsWritten >= 1;
      case 'friendsAdded':
        return userStats.friendsAdded >= 1;
      default:
        return false;
    }
  }

  /**
   * Проверка условия "количество"
   */
  private evaluateCountCondition(condition: AchievementCondition, userStats: UserStats): boolean {
    if (!condition.target || !condition.field) {
      return false;
    }

    const currentValue = userStats[condition.field as keyof UserStats] as number;
    return currentValue >= condition.target;
  }

  /**
   * Проверка условия "порог"
   */
  private evaluateThresholdCondition(condition: AchievementCondition, userStats: UserStats): boolean {
    if (!condition.target || !condition.field) {
      return false;
    }

    const currentValue = userStats[condition.field as keyof UserStats] as number;
    return currentValue >= condition.target;
  }

  /**
   * Получение статистики пользователя
   */
  private async getUserStats(userId: string, eventType?: string, eventData?: any): Promise<UserStats> {
    // В реальном приложении здесь бы были запросы к другим сервисам
    // Для MVP используем упрощенную логику на основе прогресса

    const progressRecords = await this.progressRepository.find({
      where: { userId },
      relations: ['achievement'],
    });

    const stats: UserStats = {
      gamesPurchased: 0,
      reviewsWritten: 0,
      friendsAdded: 0,
    };

    // Подсчитываем статистику на основе прогресса
    for (const progress of progressRecords) {
      switch (progress.achievement.type) {
        case AchievementType.FIRST_PURCHASE:
        case AchievementType.GAMES_PURCHASED:
          stats.gamesPurchased = Math.max(stats.gamesPurchased, progress.currentValue);
          break;
        case AchievementType.FIRST_REVIEW:
        case AchievementType.REVIEWS_WRITTEN:
          stats.reviewsWritten = Math.max(stats.reviewsWritten, progress.currentValue);
          break;
        case AchievementType.FIRST_FRIEND:
          stats.friendsAdded = Math.max(stats.friendsAdded, progress.currentValue);
          break;
      }
    }

    // Обновляем статистику на основе текущего события
    if (eventType && eventData) {
      switch (eventType) {
        case EventType.GAME_PURCHASE:
          stats.gamesPurchased += 1;
          if (!stats.firstPurchaseDate) {
            stats.firstPurchaseDate = new Date();
          }
          break;
        case EventType.REVIEW_CREATED:
          stats.reviewsWritten += 1;
          if (!stats.firstReviewDate) {
            stats.firstReviewDate = new Date();
          }
          break;
        case EventType.FRIEND_ADDED:
          stats.friendsAdded += 1;
          if (!stats.firstFriendDate) {
            stats.firstFriendDate = new Date();
          }
          break;
      }
    }

    return stats;
  }

  /**
   * Обновление прогресса для конкретного достижения
   */
  private async updateAchievementProgress(
    userId: string,
    achievement: Achievement,
    userStats: UserStats
  ): Promise<UserProgress | null> {
    try {
      // Получаем или создаем запись о прогрессе
      let progress = await this.progressRepository.findOne({
        where: { userId, achievementId: achievement.id },
        relations: ['achievement'],
      });

      const newValue = this.calculateProgressValue(achievement, userStats);
      const targetValue = this.calculateTargetValue(achievement);

      if (!progress) {
        // Создаем новую запись о прогрессе
        progress = this.progressRepository.create({
          userId,
          achievementId: achievement.id,
          currentValue: newValue,
          targetValue,
        });
        // Устанавливаем связь с достижением
        progress.achievement = achievement;
      } else {
        // Обновляем существующую запись
        progress.currentValue = newValue;
        progress.targetValue = targetValue;
        // Убеждаемся, что связь с достижением установлена
        if (!progress.achievement) {
          progress.achievement = achievement;
        }
      }

      return await this.progressRepository.save(progress);
    } catch (error) {
      this.logger.error(`Failed to update progress for achievement ${achievement.id}:`, error);
      return null;
    }
  }

  /**
   * Вычисление текущего значения прогресса
   */
  private calculateProgressValue(achievement: Achievement, userStats: UserStats): number {
    switch (achievement.type) {
      case AchievementType.FIRST_PURCHASE:
      case AchievementType.GAMES_PURCHASED:
        return userStats.gamesPurchased;
      case AchievementType.FIRST_REVIEW:
      case AchievementType.REVIEWS_WRITTEN:
        return userStats.reviewsWritten;
      case AchievementType.FIRST_FRIEND:
        return userStats.friendsAdded;
      default:
        return 0;
    }
  }

  /**
   * Вычисление целевого значения для достижения
   */
  private calculateTargetValue(achievement: Achievement): number {
    if (achievement.condition.target) {
      return achievement.condition.target;
    }

    // Для достижений "первый раз" целевое значение всегда 1
    if (achievement.condition.type === 'first_time') {
      return 1;
    }

    return 1;
  }

  /**
   * Проверка, подходит ли событие для достижения
   */
  private isEventRelevantForAchievement(eventType: EventType, achievementType: AchievementType): boolean {
    switch (eventType) {
      case EventType.GAME_PURCHASE:
        return achievementType === AchievementType.FIRST_PURCHASE ||
          achievementType === AchievementType.GAMES_PURCHASED;
      case EventType.REVIEW_CREATED:
        return achievementType === AchievementType.FIRST_REVIEW ||
          achievementType === AchievementType.REVIEWS_WRITTEN;
      case EventType.FRIEND_ADDED:
        return achievementType === AchievementType.FIRST_FRIEND;
      default:
        return false;
    }
  }

  /**
   * Получение достижения по ID (для уведомлений)
   */
  async getAchievementById(achievementId: string): Promise<Achievement | null> {
    try {
      return await this.achievementRepository.findOne({
        where: { id: achievementId },
      });
    } catch (error) {
      this.logger.error(`Failed to get achievement ${achievementId}:`, error);
      return null;
    }
  }
}
