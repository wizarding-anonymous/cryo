import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Achievement, UserAchievement } from '../entities';
import { AchievementResponseDto, UserAchievementResponseDto } from '../dto';

export interface GetUserAchievementsOptions {
  page?: number;
  limit?: number;
  type?: string;
  unlocked?: boolean;
}

@Injectable()
export class AchievementService {
  constructor(
    @InjectRepository(Achievement)
    private readonly achievementRepository: Repository<Achievement>,
    @InjectRepository(UserAchievement)
    private readonly userAchievementRepository: Repository<UserAchievement>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) { }

  /**
   * Получить все достижения с кешированием через Redis
   */
  async getAllAchievements(): Promise<AchievementResponseDto[]> {
    const cacheKey = 'achievements:all';

    // Попытка получить из кеша с обработкой ошибок
    try {
      const cached = await this.cacheManager.get<AchievementResponseDto[]>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      // Логируем ошибку кеша, но продолжаем работу
      console.warn('Cache get error:', error);
    }

    // Получение из базы данных
    const achievements = await this.achievementRepository.find({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });

    const result = achievements.map(this.mapToAchievementResponseDto);

    // Сохранение в кеш на 5 минут с обработкой ошибок
    try {
      await this.cacheManager.set(cacheKey, result, 300);
    } catch (error) {
      // Логируем ошибку кеша, но не прерываем выполнение
      console.warn('Cache set error:', error);
    }

    return result;
  }

  /**
   * Получить достижения пользователя с пагинацией и фильтрацией
   */
  async getUserAchievements(
    userId: string,
    options: GetUserAchievementsOptions = {},
  ): Promise<{
    achievements: UserAchievementResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // Валидация и нормализация параметров пагинации
    const { page, limit, type, unlocked } = options;
    const normalizedPage = Math.max(1, page || 1);
    const normalizedLimit = Math.min(100, Math.max(1, limit || 20));
    const skip = (normalizedPage - 1) * normalizedLimit;

    const cacheKey = `user:${userId}:achievements:${JSON.stringify(options)}`;

    // Попытка получить из кеша с обработкой ошибок
    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as any;
      }
    } catch (error) {
      // Логируем ошибку кеша, но продолжаем работу
      console.warn('Cache get error:', error);
    }

    const queryBuilder = this.userAchievementRepository
      .createQueryBuilder('ua')
      .leftJoinAndSelect('ua.achievement', 'achievement')
      .where('ua.userId = :userId', { userId })
      .andWhere('achievement.isActive = :isActive', { isActive: true });

    // Фильтрация по типу достижения
    if (type) {
      queryBuilder.andWhere('achievement.type = :type', { type });
    }

    // Фильтрация по статусу разблокировки
    if (unlocked !== undefined) {
      if (unlocked) {
        // Только разблокированные достижения
        queryBuilder.andWhere('ua.id IS NOT NULL');
      } else {
        // Только заблокированные достижения - нужно получить все достижения и исключить разблокированные
        const unlockedAchievementIds = await this.userAchievementRepository
          .createQueryBuilder('ua')
          .select('ua.achievementId')
          .where('ua.userId = :userId', { userId })
          .getRawMany();

        const unlockedIds = unlockedAchievementIds.map(item => item.ua_achievementId);

        // Получаем все достижения, исключая разблокированные
        const allAchievements = await this.achievementRepository
          .createQueryBuilder('achievement')
          .where('achievement.isActive = :isActive', { isActive: true })
          .andWhere(unlockedIds.length > 0 ? 'achievement.id NOT IN (:...unlockedIds)' : '1=1', { unlockedIds })
          .skip(skip)
          .take(normalizedLimit)
          .getMany();

        const total = await this.achievementRepository
          .createQueryBuilder('achievement')
          .where('achievement.isActive = :isActive', { isActive: true })
          .andWhere(unlockedIds.length > 0 ? 'achievement.id NOT IN (:...unlockedIds)' : '1=1', { unlockedIds })
          .getCount();

        const result = {
          achievements: allAchievements.map(achievement => ({
            id: null,
            userId,
            achievementId: achievement.id,
            achievement: this.mapToAchievementResponseDto(achievement),
            unlockedAt: null,
          })) as any,
          total,
          page: normalizedPage,
          limit: normalizedLimit,
          totalPages: Math.ceil(total / normalizedLimit),
        };

        // Кешируем результат на 2 минуты с обработкой ошибок
        try {
          await this.cacheManager.set(cacheKey, result, 120);
        } catch (error) {
          // Логируем ошибку кеша, но не прерываем выполнение
          console.warn('Cache set error:', error);
        }
        return result;
      }
    }

    // Получение общего количества
    const total = await queryBuilder.getCount();

    // Получение данных с пагинацией
    const userAchievements = await queryBuilder
      .orderBy('ua.unlockedAt', 'DESC')
      .skip(skip)
      .take(normalizedLimit)
      .getMany();

    const result = {
      achievements: userAchievements.map(this.mapToUserAchievementResponseDto),
      total,
      page: normalizedPage,
      limit: normalizedLimit,
      totalPages: Math.ceil(total / normalizedLimit),
    };

    // Кешируем результат на 2 минуты с обработкой ошибок
    try {
      await this.cacheManager.set(cacheKey, result, 120);
    } catch (error) {
      // Логируем ошибку кеша, но не прерываем выполнение
      console.warn('Cache set error:', error);
    }

    return result;
  }

  /**
   * Разблокировать достижение с проверкой дублирования
   */
  async unlockAchievement(userId: string, achievementId: string): Promise<UserAchievementResponseDto> {
    // Проверяем, существует ли достижение
    const achievement = await this.achievementRepository.findOne({
      where: { id: achievementId, isActive: true },
    });

    if (!achievement) {
      throw new NotFoundException(`Achievement with ID ${achievementId} not found`);
    }

    // Проверяем, не разблокировано ли уже достижение
    const existingUserAchievement = await this.userAchievementRepository.findOne({
      where: { userId, achievementId },
      relations: ['achievement'],
    });

    if (existingUserAchievement) {
      throw new ConflictException(`Achievement ${achievementId} already unlocked for user ${userId}`);
    }

    // Создаем новую запись о разблокированном достижении
    const userAchievement = this.userAchievementRepository.create({
      userId,
      achievementId,
    });

    const savedUserAchievement = await this.userAchievementRepository.save(userAchievement);

    // Получаем полную информацию с достижением
    const fullUserAchievement = await this.userAchievementRepository.findOne({
      where: { id: savedUserAchievement.id },
      relations: ['achievement'],
    });

    if (!fullUserAchievement) {
      throw new Error('Failed to retrieve saved user achievement');
    }

    // Очищаем кеш пользователя
    await this.clearUserCache(userId);

    return this.mapToUserAchievementResponseDto(fullUserAchievement);
  }

  /**
   * Проверить, разблокировано ли достижение для пользователя
   */
  async isAchievementUnlocked(userId: string, achievementId: string): Promise<boolean> {
    const cacheKey = `user:${userId}:achievement:${achievementId}:unlocked`;

    // Попытка получить из кеша
    const cached = await this.cacheManager.get<boolean>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const userAchievement = await this.userAchievementRepository.findOne({
      where: { userId, achievementId },
    });

    const isUnlocked = !!userAchievement;

    // Кешируем результат на 5 минут
    await this.cacheManager.set(cacheKey, isUnlocked, 300);

    return isUnlocked;
  }

  /**
   * Очистить кеш пользователя
   */
  private async clearUserCache(userId: string): Promise<void> {
    // В реальном приложении нужно использовать более эффективный способ очистки кеша по паттерну
    // Здесь упрощенная версия - очищаем основные ключи
    try {
      await this.cacheManager.del(`user:${userId}:achievements:{"page":1,"limit":20}`);
      await this.cacheManager.del(`user:${userId}:achievements:{"page":1,"limit":20,"unlocked":true}`);
      await this.cacheManager.del(`user:${userId}:achievements:{"page":1,"limit":20,"unlocked":false}`);
    } catch (error) {
      // Игнорируем ошибки очистки кеша
      console.warn('Failed to clear user cache:', error);
    }
  }

  /**
   * Маппинг Achievement в AchievementResponseDto
   */
  private mapToAchievementResponseDto = (achievement: Achievement): AchievementResponseDto => {
    return {
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      type: achievement.type,
      iconUrl: achievement.iconUrl,
      points: achievement.points,
      condition: achievement.condition,
      isActive: achievement.isActive,
      createdAt: achievement.createdAt,
      updatedAt: achievement.updatedAt,
    };
  }

  /**
   * Маппинг UserAchievement в UserAchievementResponseDto
   */
  private mapToUserAchievementResponseDto = (userAchievement: UserAchievement): UserAchievementResponseDto => {
    return {
      id: userAchievement.id,
      userId: userAchievement.userId,
      achievementId: userAchievement.achievementId,
      achievement: this.mapToAchievementResponseDto(userAchievement.achievement),
      unlockedAt: userAchievement.unlockedAt,
    };
  }
}
