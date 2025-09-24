import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameRating } from '../entities/game-rating.entity';
import { Review } from '../entities/review.entity';
import { RatingService } from './rating.service';
import { MetricsService } from './metrics.service';

@Injectable()
export class RatingSchedulerService {
  private readonly logger = new Logger(RatingSchedulerService.name);
  private isRecalculationRunning = false;

  constructor(
    @InjectRepository(GameRating)
    private readonly gameRatingRepository: Repository<GameRating>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    private readonly ratingService: RatingService,
    private readonly metricsService: MetricsService,
  ) {}

  // Запускается каждый день в 2:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async recalculateAllGameRatings(): Promise<void> {
    if (this.isRecalculationRunning) {
      this.logger.warn('Rating recalculation is already running, skipping...');
      return;
    }

    this.isRecalculationRunning = true;
    const startTime = Date.now();
    
    try {
      this.logger.log('Starting bulk rating recalculation for all games');
      this.metricsService.recordBulkOperation('recalculate', 'success');

      // Получаем все уникальные gameId из отзывов
      const gameIds = await this.reviewRepository
        .createQueryBuilder('review')
        .select('DISTINCT review.gameId', 'gameId')
        .getRawMany();

      const totalGames = gameIds.length;
      this.logger.log(`Found ${totalGames} games with reviews to recalculate`);

      let processedGames = 0;
      let errors = 0;

      // Обновляем системную нагрузку
      this.metricsService.updateRatingSystemLoad(0.8); // Высокая нагрузка во время пересчета

      // Обрабатываем игры батчами по 10
      const batchSize = 10;
      for (let i = 0; i < gameIds.length; i += batchSize) {
        const batch = gameIds.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async ({ gameId }) => {
          const gameStartTime = Date.now();
          
          try {
            this.metricsService.incrementActiveCalculations();
            await this.ratingService.updateGameRating(gameId);
            
            const duration = (Date.now() - gameStartTime) / 1000;
            this.metricsService.recordRatingCalculation(gameId, 'bulk_recalculate');
            this.metricsService.recordRatingCalculationDuration(gameId, duration);
            
            processedGames++;
            
            if (processedGames % 50 === 0) {
              this.logger.debug(`Processed ${processedGames}/${totalGames} games`);
              
              // Обновляем прогресс в метриках
              const progress = processedGames / totalGames;
              this.metricsService.updateRatingSystemLoad(0.8 * (1 - progress) + 0.2);
            }
          } catch (error) {
            errors++;
            this.logger.error(`Failed to recalculate rating for game ${gameId}`, error);
          } finally {
            this.metricsService.decrementActiveCalculations();
          }
        });

        await Promise.allSettled(batchPromises);
        
        // Небольшая пауза между батчами для снижения нагрузки
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const totalDuration = (Date.now() - startTime) / 1000;
      this.metricsService.recordBulkOperationDuration('recalculate', totalDuration);
      
      this.logger.log(
        `Bulk rating recalculation completed. ` +
        `Processed: ${processedGames}/${totalGames} games, ` +
        `Errors: ${errors}, ` +
        `Duration: ${totalDuration.toFixed(2)}s`
      );

      // Обновляем статистику кеша
      await this.updateCacheStatistics();

      // Сбрасываем системную нагрузку
      this.metricsService.updateRatingSystemLoad(0.1);

      if (errors > 0) {
        this.metricsService.recordBulkOperation('recalculate', 'error');
      }

    } catch (error) {
      this.metricsService.recordBulkOperation('recalculate', 'error');
      this.metricsService.updateRatingSystemLoad(0.1);
      this.logger.error('Bulk rating recalculation failed', error);
    } finally {
      this.isRecalculationRunning = false;
    }
  }

  // Запускается каждые 30 минут для очистки устаревших записей кеша
  @Cron(CronExpression.EVERY_30_MINUTES)
  async cleanupStaleRatings(): Promise<void> {
    try {
      this.logger.debug('Starting cleanup of stale rating records');

      // Удаляем записи рейтингов для игр, у которых нет отзывов
      const staleRatings = await this.gameRatingRepository
        .createQueryBuilder('rating')
        .leftJoin(Review, 'review', 'review.gameId = rating.gameId')
        .where('review.gameId IS NULL')
        .getMany();

      if (staleRatings.length > 0) {
        await this.gameRatingRepository.remove(staleRatings);
        this.logger.log(`Removed ${staleRatings.length} stale rating records`);
      }

      // Обновляем статистику кеша
      await this.updateCacheStatistics();

    } catch (error) {
      this.logger.error('Failed to cleanup stale ratings', error);
    }
  }

  // Запускается каждые 5 минут для обновления метрик
  @Cron(CronExpression.EVERY_5_MINUTES)
  async updateMetrics(): Promise<void> {
    try {
      await this.updateCacheStatistics();
      await this.updateCachePerformanceMetrics();
      
      // Логируем текущие метрики
      const summary = await this.metricsService.getRatingMetricsSummary();
      this.logger.debug(
        `Rating metrics - Calculations: ${summary.totalCalculations}, ` +
        `Cache ops: ${summary.totalCacheOperations}, ` +
        `Active: ${summary.activeCalculations}, ` +
        `Cached: ${summary.cachedRatingsCount}`
      );
    } catch (error) {
      this.logger.error('Failed to update metrics', error);
    }
  }

  // Запускается каждые 15 минут для интеллектуального прогрева кеша
  @Cron('0 */15 * * * *') // Каждые 15 минут
  async intelligentCacheWarmup(): Promise<void> {
    try {
      this.logger.debug('Starting scheduled intelligent cache warmup');
      
      const result = await this.ratingService.intelligentCacheWarmup();
      
      this.logger.log(
        `Scheduled cache warmup completed. ` +
        `Warmed: ${result.warmedGames} games, ` +
        `Errors: ${result.errors}, ` +
        `Duration: ${result.duration.toFixed(2)}s`
      );
    } catch (error) {
      this.logger.error('Scheduled cache warmup failed', error);
    }
  }

  // Запускается каждый час для оптимизированного пересчета приоритетных рейтингов
  @Cron(CronExpression.EVERY_HOUR)
  async hourlyPriorityRatingUpdate(): Promise<void> {
    try {
      this.logger.debug('Starting hourly priority rating update');
      
      // Получаем игры с высокой активностью (много новых отзывов за последний час)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const activeGames = await this.reviewRepository
        .createQueryBuilder('review')
        .select('review.gameId')
        .addSelect('COUNT(*)', 'recentReviews')
        .where('review.createdAt > :oneHourAgo', { oneHourAgo })
        .groupBy('review.gameId')
        .having('COUNT(*) >= 2') // Минимум 2 новых отзыва за час
        .orderBy('COUNT(*)', 'DESC')
        .limit(20)
        .getRawMany();

      if (activeGames.length > 0) {
        const priorityGameIds = activeGames.map(g => g.gameId);
        
        const result = await this.ratingService.optimizedRatingRecalculation({
          priorityGames: priorityGameIds,
          maxConcurrency: 3,
          skipRecentlyUpdated: false,
        });
        
        this.logger.log(
          `Hourly priority update completed. ` +
          `Processed: ${result.processed}/${priorityGameIds.length} games, ` +
          `Errors: ${result.errors}, Duration: ${result.duration.toFixed(2)}s`
        );
      } else {
        this.logger.debug('No high-activity games found for priority update');
      }
    } catch (error) {
      this.logger.error('Hourly priority rating update failed', error);
    }
  }

  // Запускается каждые 6 часов для очистки и оптимизации кеша
  @Cron('0 0 */6 * * *') // Каждые 6 часов
  async cacheOptimization(): Promise<void> {
    try {
      this.logger.debug('Starting cache optimization');
      
      // Получаем аналитику производительности
      const analytics = await this.ratingService.getPerformanceAnalytics();
      
      this.logger.log(
        `Cache performance - Hit rate: ${analytics.cacheEfficiency.hitRate}%, ` +
        `Avg response: ${analytics.cacheEfficiency.averageResponseTime.toFixed(3)}s, ` +
        `Memory usage: ${analytics.systemLoad.memoryUsage.toFixed(1)}MB`
      );
      
      // Если hit rate низкий, запускаем дополнительный прогрев
      if (analytics.cacheEfficiency.hitRate < 0.7) {
        this.logger.warn('Low cache hit rate detected, starting additional warmup');
        await this.ratingService.intelligentCacheWarmup();
      }
      
      // Если использование памяти высокое, логируем предупреждение
      if (analytics.systemLoad.memoryUsage > 500) {
        this.logger.warn(`High memory usage detected: ${analytics.systemLoad.memoryUsage.toFixed(1)}MB`);
      }
      
    } catch (error) {
      this.logger.error('Cache optimization failed', error);
    }
  }

  // Ручной запуск пересчета рейтингов для конкретных игр
  async recalculateRatingsForGames(gameIds: string[]): Promise<{
    processed: number;
    errors: number;
    duration: number;
  }> {
    const startTime = Date.now();
    let processed = 0;
    let errors = 0;

    this.logger.log(`Starting manual rating recalculation for ${gameIds.length} games`);

    for (const gameId of gameIds) {
      const gameStartTime = Date.now();
      
      try {
        this.metricsService.incrementActiveCalculations();
        await this.ratingService.updateGameRating(gameId);
        
        const duration = (Date.now() - gameStartTime) / 1000;
        this.metricsService.recordRatingCalculation(gameId, 'update');
        this.metricsService.recordRatingCalculationDuration(gameId, duration);
        
        processed++;
      } catch (error) {
        errors++;
        this.logger.error(`Failed to recalculate rating for game ${gameId}`, error);
      } finally {
        this.metricsService.decrementActiveCalculations();
      }
    }

    const totalDuration = (Date.now() - startTime) / 1000;
    
    this.logger.log(
      `Manual rating recalculation completed. ` +
      `Processed: ${processed}/${gameIds.length}, ` +
      `Errors: ${errors}, ` +
      `Duration: ${totalDuration.toFixed(2)}s`
    );

    return {
      processed,
      errors,
      duration: totalDuration,
    };
  }

  // Получение статуса фоновых задач
  getSchedulerStatus(): {
    isRecalculationRunning: boolean;
    lastRecalculationTime?: Date;
    nextRecalculationTime?: Date;
  } {
    // Следующий запуск в 2:00 AM
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setHours(2, 0, 0, 0);
    
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return {
      isRecalculationRunning: this.isRecalculationRunning,
      nextRecalculationTime: nextRun,
    };
  }

  private async updateCacheStatistics(): Promise<void> {
    try {
      // Подсчитываем количество записей в кеше (приблизительно)
      const totalRatings = await this.gameRatingRepository.count();
      this.metricsService.updateCachedRatingsCount(totalRatings);
    } catch (error) {
      this.logger.error('Failed to update cache statistics', error);
    }
  }

  private async updateCachePerformanceMetrics(): Promise<void> {
    try {
      const summary = await this.metricsService.getRatingMetricsSummary();
      
      // Вычисляем hit rate из операций кеша
      if (summary.totalCacheOperations > 0) {
        // Примерная оценка hit rate на основе соотношения операций
        const estimatedHitRate = Math.min(0.95, Math.max(0.1, 
          (summary.totalCacheOperations - summary.totalCalculations) / summary.totalCacheOperations
        ));
        this.metricsService.updateCacheHitRatio(estimatedHitRate);
      }

      // Обновляем системную нагрузку на основе активных вычислений
      const maxConcurrentCalculations = 50; // Максимальное количество одновременных вычислений
      const currentLoad = Math.min(1, summary.activeCalculations / maxConcurrentCalculations);
      this.metricsService.updateRatingSystemLoad(currentLoad);

    } catch (error) {
      this.logger.error('Failed to update cache performance metrics', error);
    }
  }
}