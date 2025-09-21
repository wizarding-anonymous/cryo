import { Injectable, Logger } from '@nestjs/common';
import { register, Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  // Счетчики для операций с рейтингами
  private readonly ratingCalculationsCounter = new Counter({
    name: 'rating_calculations_total',
    help: 'Total number of rating calculations performed',
    labelNames: ['game_id', 'operation_type'],
  });

  private readonly ratingCacheOperationsCounter = new Counter({
    name: 'rating_cache_operations_total',
    help: 'Total number of rating cache operations',
    labelNames: ['operation', 'result'],
  });

  // Гистограммы для времени выполнения
  private readonly ratingCalculationDuration = new Histogram({
    name: 'rating_calculation_duration_seconds',
    help: 'Duration of rating calculations in seconds',
    labelNames: ['game_id'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  });

  private readonly ratingCacheOperationDuration = new Histogram({
    name: 'rating_cache_operation_duration_seconds',
    help: 'Duration of rating cache operations in seconds',
    labelNames: ['operation'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  });

  // Gauge для текущих метрик
  private readonly activeRatingCalculations = new Gauge({
    name: 'active_rating_calculations',
    help: 'Number of currently active rating calculations',
  });

  private readonly cachedRatingsCount = new Gauge({
    name: 'cached_ratings_count',
    help: 'Number of ratings currently in cache',
  });

  private readonly averageRatingCalculationTime = new Gauge({
    name: 'average_rating_calculation_time_seconds',
    help: 'Average time for rating calculations in seconds',
  });

  constructor() {
    // Регистрируем метрики
    register.registerMetric(this.ratingCalculationsCounter);
    register.registerMetric(this.ratingCacheOperationsCounter);
    register.registerMetric(this.ratingCalculationDuration);
    register.registerMetric(this.ratingCacheOperationDuration);
    register.registerMetric(this.activeRatingCalculations);
    register.registerMetric(this.cachedRatingsCount);
    register.registerMetric(this.averageRatingCalculationTime);
  }

  // Методы для отслеживания операций с рейтингами
  recordRatingCalculation(gameId: string, operationType: 'create' | 'update' | 'delete' | 'bulk_recalculate'): void {
    this.ratingCalculationsCounter.inc({ game_id: gameId, operation_type: operationType });
  }

  recordRatingCalculationDuration(gameId: string, duration: number): void {
    this.ratingCalculationDuration.observe({ game_id: gameId }, duration);
    // Update average calculation time asynchronously without blocking
    this.updateAverageCalculationTime().catch(error => {
      this.logger.warn('Failed to update average calculation time', error);
    });
  }

  recordCacheOperation(operation: 'get' | 'set' | 'delete' | 'invalidate', result: 'hit' | 'miss' | 'success' | 'error'): void {
    this.ratingCacheOperationsCounter.inc({ operation, result });
  }

  recordCacheOperationDuration(operation: string, duration: number): void {
    this.ratingCacheOperationDuration.observe({ operation }, duration);
  }

  incrementActiveCalculations(): void {
    this.activeRatingCalculations.inc();
  }

  decrementActiveCalculations(): void {
    this.activeRatingCalculations.dec();
  }

  updateCachedRatingsCount(count: number): void {
    this.cachedRatingsCount.set(count);
  }

  private async updateAverageCalculationTime(): Promise<void> {
    // Получаем среднее время из гистограммы
    const metric = register.getSingleMetric('rating_calculation_duration_seconds') as Histogram<string>;
    if (metric) {
      const metricData = await metric.get();
      const values = metricData.values;
      if (values.length > 0) {
        // Вычисляем простое среднее время без привязки к game_id
        const totalTime = values.reduce((sum, value) => sum + value.value, 0);
        const totalCount = values.length;
        if (totalCount > 0) {
          this.averageRatingCalculationTime.set(totalTime / totalCount);
        }
      }
    }
  }

  // Метод для получения всех метрик
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  // Метод для получения сводной статистики
  async getRatingMetricsSummary(): Promise<{
    totalCalculations: number;
    totalCacheOperations: number;
    activeCalculations: number;
    cachedRatingsCount: number;
    averageCalculationTime: number;
  }> {
    const calculationsMetric = register.getSingleMetric('rating_calculations_total') as Counter<string>;
    const cacheMetric = register.getSingleMetric('rating_cache_operations_total') as Counter<string>;
    
    let totalCalculations = 0;
    let totalCacheOperations = 0;

    if (calculationsMetric) {
      const calculationsData = await calculationsMetric.get();
      totalCalculations = calculationsData.values.reduce((sum, value) => sum + value.value, 0);
    }

    if (cacheMetric) {
      const cacheData = await cacheMetric.get();
      totalCacheOperations = cacheData.values.reduce((sum, value) => sum + value.value, 0);
    }

    const [activeCalcsData, cachedRatingsData, avgTimeData] = await Promise.all([
      this.activeRatingCalculations.get(),
      this.cachedRatingsCount.get(),
      this.averageRatingCalculationTime.get(),
    ]);

    return {
      totalCalculations,
      totalCacheOperations,
      activeCalculations: activeCalcsData.values[0]?.value || 0,
      cachedRatingsCount: cachedRatingsData.values[0]?.value || 0,
      averageCalculationTime: avgTimeData.values[0]?.value || 0,
    };
  }

  // Метод для сброса метрик (для тестирования)
  resetMetrics(): void {
    register.clear();
    this.logger.debug('All metrics have been reset');
  }
}