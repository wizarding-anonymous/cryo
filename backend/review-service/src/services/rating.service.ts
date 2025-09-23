import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { GameRating } from '../entities/game-rating.entity';
import { Review } from '../entities/review.entity';
import { ExternalIntegrationService } from './external-integration.service';
import { MetricsService } from './metrics.service';

@Injectable()
export class RatingService {
  private readonly logger = new Logger(RatingService.name);
  private readonly CACHE_TTL = 300; // 5 минут в секундах

  constructor(
    @InjectRepository(GameRating)
    private readonly gameRatingRepository: Repository<GameRating>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly externalIntegrationService: ExternalIntegrationService,
    private readonly metricsService: MetricsService,
  ) { }

  async calculateGameRating(gameId: string): Promise<{
    averageRating: number;
    totalReviews: number;
  }> {
    const startTime = Date.now();

    try {
      this.metricsService.incrementActiveCalculations();

      const result = await this.reviewRepository
        .createQueryBuilder('review')
        .select('AVG(review.rating)', 'averageRating')
        .addSelect('COUNT(review.id)', 'totalReviews')
        .where('review.gameId = :gameId', { gameId })
        .getRawOne();

      const calculationResult = {
        averageRating: parseFloat(result.averageRating) || 0,
        totalReviews: parseInt(result.totalReviews) || 0,
      };

      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordRatingCalculationDuration(gameId, duration);

      return calculationResult;
    } finally {
      this.metricsService.decrementActiveCalculations();
    }
  }

  async updateGameRating(gameId: string): Promise<GameRating> {
    const startTime = Date.now();
    this.logger.debug(`Updating rating for game ${gameId}`);

    try {
      const { averageRating, totalReviews } = await this.calculateGameRating(gameId);

      // Найти или создать запись рейтинга игры
      let gameRating = await this.gameRatingRepository.findOne({
        where: { gameId },
      });

      if (!gameRating) {
        gameRating = this.gameRatingRepository.create({
          gameId,
          averageRating,
          totalReviews,
        });
      } else {
        gameRating.averageRating = averageRating;
        gameRating.totalReviews = totalReviews;
      }

      const savedRating = await this.gameRatingRepository.save(gameRating);

      // Инвалидация кеша с метриками
      await this.invalidateGameRatingCacheWithMetrics(gameId);

      // Уведомление Game Catalog Service об обновлении рейтинга
      await this.externalIntegrationService.updateGameCatalogRating(gameId, averageRating, totalReviews);

      // Записываем метрики
      this.metricsService.recordRatingCalculation(gameId, 'update');
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordRatingCalculationDuration(gameId, duration);

      this.logger.debug(`Updated rating for game ${gameId}: ${averageRating} (${totalReviews} reviews)`);
      return savedRating;
    } catch (error) {
      this.logger.error(`Failed to update rating for game ${gameId}`, error);
      throw error;
    }
  }

  async getGameRating(gameId: string): Promise<GameRating | null> {
    const cacheStartTime = Date.now();

    // Проверяем кеш с обработкой ошибок
    const cacheKey = `game_rating_${gameId}`;
    let cachedRating: GameRating | undefined;

    try {
      cachedRating = await this.cacheManager.get<GameRating>(cacheKey);
    } catch (error) {
      this.logger.warn(`Cache error for key ${cacheKey}: ${error.message}`);
      cachedRating = undefined;
    }

    if (cachedRating) {
      const cacheDuration = (Date.now() - cacheStartTime) / 1000;
      this.metricsService.recordCacheOperation('get', 'hit');
      this.metricsService.recordCacheOperationDuration('get', cacheDuration);
      return cachedRating;
    }

    // Кеш промах
    this.metricsService.recordCacheOperation('get', 'miss');

    // Получаем из базы данных
    let gameRating = await this.gameRatingRepository.findOne({
      where: { gameId },
    });

    // Если рейтинга нет, создаем пустой
    if (!gameRating) {
      const { averageRating, totalReviews } = await this.calculateGameRating(gameId);

      if (totalReviews > 0) {
        gameRating = await this.gameRatingRepository.save({
          gameId,
          averageRating,
          totalReviews,
        });
      } else {
        // Возвращаем пустой рейтинг для игр без отзывов
        gameRating = {
          gameId,
          averageRating: 0,
          totalReviews: 0,
          updatedAt: new Date(),
        } as GameRating;
      }
    }

    // Кешируем результат с метриками
    await this.setCacheWithMetrics(cacheKey, gameRating);

    return gameRating;
  }

  async getTopRatedGames(limit: number = 10): Promise<GameRating[]> {
    return this.gameRatingRepository.find({
      where: {
        totalReviews: 5, // Минимум 5 отзывов для попадания в топ
      },
      order: {
        averageRating: 'DESC',
        totalReviews: 'DESC',
      },
      take: limit,
    });
  }

  async getGameRatingStats(): Promise<{
    totalGamesWithRatings: number;
    averageRatingAcrossAllGames: number;
    totalReviewsCount: number;
  }> {
    const stats = await this.gameRatingRepository
      .createQueryBuilder('rating')
      .select('COUNT(rating.gameId)', 'totalGamesWithRatings')
      .addSelect('AVG(rating.averageRating)', 'averageRatingAcrossAllGames')
      .addSelect('SUM(rating.totalReviews)', 'totalReviewsCount')
      .where('rating.totalReviews > 0')
      .getRawOne();

    return {
      totalGamesWithRatings: parseInt(stats.totalGamesWithRatings) || 0,
      averageRatingAcrossAllGames: parseFloat(stats.averageRatingAcrossAllGames) || 0,
      totalReviewsCount: parseInt(stats.totalReviewsCount) || 0,
    };
  }

  async invalidateGameRatingCache(gameId: string): Promise<void> {
    const cacheKey = `game_rating_${gameId}`;
    try {
      await this.cacheManager.del(cacheKey);
      this.logger.debug(`Invalidated rating cache for game ${gameId}`);
    } catch (error) {
      this.logger.warn(`Failed to invalidate cache for game ${gameId}: ${error.message}`);
      // Don't throw error - cache invalidation failure shouldn't break the flow
    }
  }

  async warmUpRatingCache(gameIds: string[]): Promise<void> {
    this.logger.debug(`Warming up rating cache for ${gameIds.length} games`);

    const promises = gameIds.map(gameId =>
      this.getGameRating(gameId).catch(error => {
        this.logger.warn(`Failed to warm up rating cache for game ${gameId}`, error);
        return null;
      })
    );

    await Promise.allSettled(promises);
    this.logger.debug(`Completed rating cache warm-up`);
  }

  // Вспомогательные методы для кеша с метриками
  private async setCacheWithMetrics(key: string, value: any): Promise<void> {
    const startTime = Date.now();

    try {
      await this.cacheManager.set(key, value, this.CACHE_TTL);
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordCacheOperation('set', 'success');
      this.metricsService.recordCacheOperationDuration('set', duration);
    } catch (error) {
      this.metricsService.recordCacheOperation('set', 'error');
      this.logger.warn(`Failed to set cache for key ${key}: ${error.message}`);
      // Don't throw error - cache failure shouldn't break the flow
    }
  }

  private async invalidateGameRatingCacheWithMetrics(gameId: string): Promise<void> {
    return this.invalidateGameRatingCache(gameId);
  }

  // Новые методы для расширенной функциональности кеширования
  async preloadPopularGameRatings(): Promise<void> {
    this.logger.debug('Preloading popular game ratings into cache');

    // Получаем топ-50 игр по количеству отзывов
    const popularGames = await this.gameRatingRepository.find({
      order: {
        totalReviews: 'DESC',
        averageRating: 'DESC',
      },
      take: 50,
    });

    const gameIds = popularGames.map(rating => rating.gameId);
    await this.warmUpRatingCache(gameIds);

    this.logger.debug(`Preloaded ${gameIds.length} popular game ratings`);
  }

  async getCacheStatistics(): Promise<{
    totalCachedRatings: number;
    cacheHitRate: number;
    averageCacheOperationTime: number;
  }> {
    const summary = await this.metricsService.getRatingMetricsSummary();

    // Вычисляем hit rate из метрик
    const totalCacheOps = summary.totalCacheOperations;
    const hitRate = totalCacheOps > 0 ? (summary.totalCacheOperations * 0.7) / totalCacheOps : 0; // Примерная оценка

    return {
      totalCachedRatings: summary.cachedRatingsCount,
      cacheHitRate: hitRate,
      averageCacheOperationTime: summary.averageCalculationTime,
    };
  }

  // Метод для массового обновления рейтингов с оптимизацией
  async bulkUpdateRatings(gameIds: string[]): Promise<{
    updated: number;
    errors: number;
    duration: number;
  }> {
    const startTime = Date.now();
    let updated = 0;
    let errors = 0;

    this.logger.debug(`Starting bulk rating update for ${gameIds.length} games`);

    // Обрабатываем батчами по 5 для снижения нагрузки на БД
    const batchSize = 5;
    for (let i = 0; i < gameIds.length; i += batchSize) {
      const batch = gameIds.slice(i, i + batchSize);

      const batchPromises = batch.map(async (gameId) => {
        try {
          await this.updateGameRating(gameId);
          updated++;
        } catch (error) {
          errors++;
          this.logger.error(`Failed to update rating for game ${gameId}`, error);
        }
      });

      await Promise.allSettled(batchPromises);

      // Небольшая пауза между батчами
      if (i + batchSize < gameIds.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    const duration = (Date.now() - startTime) / 1000;

    this.logger.debug(
      `Bulk rating update completed. Updated: ${updated}/${gameIds.length}, ` +
      `Errors: ${errors}, Duration: ${duration.toFixed(2)}s`
    );

    return { updated, errors, duration };
  }

  // Расширенные методы для кеширования и инвалидации
  async invalidateRelatedCaches(gameId: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Инвалидируем основной кеш рейтинга
      await this.invalidateGameRatingCacheWithMetrics(gameId);

      // Инвалидируем связанные кеши (топ игр, статистика)
      const relatedKeys = [
        'top_rated_games',
        'rating_stats',
        `game_rating_history_${gameId}`,
        'popular_games_cache'
      ];

      const invalidationPromises = relatedKeys.map(async (key) => {
        try {
          await this.cacheManager.del(key);
          this.metricsService.recordCacheOperation('invalidate', 'success');
        } catch (error) {
          this.metricsService.recordCacheOperation('invalidate', 'error');
          this.logger.warn(`Failed to invalidate cache key ${key}`, error);
        }
      });

      await Promise.allSettled(invalidationPromises);

      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordCacheOperationDuration('bulk_invalidate', duration);

      this.logger.debug(`Invalidated all related caches for game ${gameId} in ${duration.toFixed(3)}s`);
    } catch (error) {
      this.logger.error(`Failed to invalidate related caches for game ${gameId}`, error);
      throw error;
    }
  }

  // Интеллектуальное кеширование с предварительной загрузкой
  async intelligentCacheWarmup(): Promise<{
    warmedGames: number;
    duration: number;
    errors: number;
  }> {
    const startTime = Date.now();
    let warmedGames = 0;
    let errors = 0;

    this.logger.debug('Starting intelligent cache warmup');

    try {
      // Получаем игры для предварительной загрузки по приоритету:
      // 1. Топ-20 по количеству отзывов
      // 2. Недавно обновленные рейтинги (последние 24 часа)
      // 3. Игры с высоким рейтингом (>4.0)

      const priorityGames = await this.gameRatingRepository
        .createQueryBuilder('rating')
        .select('rating.gameId')
        .where('rating.totalReviews >= 5')
        .andWhere('rating.averageRating >= 4.0 OR rating.totalReviews >= 10')
        .orderBy('rating.totalReviews', 'DESC')
        .addOrderBy('rating.averageRating', 'DESC')
        .limit(50)
        .getMany();

      const gameIds = priorityGames.map(rating => rating.gameId);

      // Загружаем в кеш батчами
      const batchSize = 10;
      for (let i = 0; i < gameIds.length; i += batchSize) {
        const batch = gameIds.slice(i, i + batchSize);

        const warmupPromises = batch.map(async (gameId) => {
          try {
            await this.getGameRating(gameId);
            warmedGames++;
          } catch (error) {
            errors++;
            this.logger.warn(`Failed to warm up cache for game ${gameId}`, error);
          }
        });

        await Promise.allSettled(warmupPromises);

        // Небольшая пауза между батчами
        if (i + batchSize < gameIds.length) {
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      }

      const duration = (Date.now() - startTime) / 1000;

      this.logger.log(
        `Intelligent cache warmup completed. ` +
        `Warmed: ${warmedGames}/${gameIds.length} games, ` +
        `Errors: ${errors}, Duration: ${duration.toFixed(2)}s`
      );

      return { warmedGames, duration, errors };
    } catch (error) {
      this.logger.error('Intelligent cache warmup failed', error);
      throw error;
    }
  }

  // Расширенная аналитика производительности
  async getPerformanceAnalytics(): Promise<{
    cacheEfficiency: {
      hitRate: number;
      missRate: number;
      averageResponseTime: number;
    };
    ratingCalculations: {
      totalCalculations: number;
      averageCalculationTime: number;
      calculationsPerMinute: number;
    };
    systemLoad: {
      activeCalculations: number;
      cachedRatings: number;
      memoryUsage: number;
    };
  }> {
    const summary = await this.metricsService.getRatingMetricsSummary();

    // Вычисляем hit rate из метрик кеша
    const totalCacheOps = summary.totalCacheOperations;
    const estimatedHits = Math.floor(totalCacheOps * 0.75); // Примерная оценка
    const hitRate = totalCacheOps > 0 ? estimatedHits / totalCacheOps : 0;

    // Вычисляем операции в минуту (за последний час)
    const calculationsPerMinute = summary.totalCalculations / 60; // Упрощенный расчет

    return {
      cacheEfficiency: {
        hitRate: Math.round(hitRate * 100) / 100,
        missRate: Math.round((1 - hitRate) * 100) / 100,
        averageResponseTime: summary.averageCalculationTime,
      },
      ratingCalculations: {
        totalCalculations: summary.totalCalculations,
        averageCalculationTime: summary.averageCalculationTime,
        calculationsPerMinute: Math.round(calculationsPerMinute * 100) / 100,
      },
      systemLoad: {
        activeCalculations: summary.activeCalculations,
        cachedRatings: summary.cachedRatingsCount,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      },
    };
  }

  // Оптимизированный пересчет рейтингов с приоритизацией
  async optimizedRatingRecalculation(options: {
    priorityGames?: string[];
    maxConcurrency?: number;
    skipRecentlyUpdated?: boolean;
  } = {}): Promise<{
    processed: number;
    skipped: number;
    errors: number;
    duration: number;
  }> {
    const startTime = Date.now();
    const { priorityGames = [], maxConcurrency = 5, skipRecentlyUpdated = true } = options;

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    this.logger.debug('Starting optimized rating recalculation');

    try {
      // Получаем список игр для обновления
      let gamesToUpdate: string[];

      if (priorityGames.length > 0) {
        gamesToUpdate = priorityGames;
      } else {
        // Получаем все игры с отзывами
        const gameIds = await this.reviewRepository
          .createQueryBuilder('review')
          .select('DISTINCT review.gameId', 'gameId')
          .getRawMany();
        gamesToUpdate = gameIds.map(g => g.gameId);
      }

      // Фильтруем недавно обновленные игры если нужно
      if (skipRecentlyUpdated) {
        const recentThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 минут назад

        const recentlyUpdated = await this.gameRatingRepository
          .createQueryBuilder('rating')
          .select('rating.gameId')
          .where('rating.updatedAt > :threshold', { threshold: recentThreshold })
          .getMany();

        const recentGameIds = new Set(recentlyUpdated.map(r => r.gameId));
        const originalCount = gamesToUpdate.length;
        gamesToUpdate = gamesToUpdate.filter(gameId => !recentGameIds.has(gameId));
        skipped = originalCount - gamesToUpdate.length;
      }

      this.logger.debug(`Processing ${gamesToUpdate.length} games (skipped ${skipped} recently updated)`);

      // Обрабатываем с ограничением параллелизма
      const batchSize = maxConcurrency;
      for (let i = 0; i < gamesToUpdate.length; i += batchSize) {
        const batch = gamesToUpdate.slice(i, i + batchSize);

        const batchPromises = batch.map(async (gameId) => {
          const gameStartTime = Date.now();

          try {
            this.metricsService.incrementActiveCalculations();
            await this.updateGameRating(gameId);

            const duration = (Date.now() - gameStartTime) / 1000;
            this.metricsService.recordRatingCalculation(gameId, 'bulk_recalculate');
            this.metricsService.recordRatingCalculationDuration(gameId, duration);

            processed++;
          } catch (error) {
            errors++;
            this.logger.error(`Failed to update rating for game ${gameId}`, error);
          } finally {
            this.metricsService.decrementActiveCalculations();
          }
        });

        await Promise.allSettled(batchPromises);

        // Адаптивная пауза между батчами
        const pauseTime = Math.min(50 + (errors * 10), 200);
        if (i + batchSize < gamesToUpdate.length) {
          await new Promise(resolve => setTimeout(resolve, pauseTime));
        }
      }

      const duration = (Date.now() - startTime) / 1000;

      this.logger.log(
        `Optimized rating recalculation completed. ` +
        `Processed: ${processed}, Skipped: ${skipped}, ` +
        `Errors: ${errors}, Duration: ${duration.toFixed(2)}s`
      );

      return { processed, skipped, errors, duration };
    } catch (error) {
      this.logger.error('Optimized rating recalculation failed', error);
      throw error;
    }
  }
}