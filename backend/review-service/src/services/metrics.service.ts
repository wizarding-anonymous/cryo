import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { register, Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);

  // Счетчики для операций с рейтингами
  private ratingCalculationsCounter: Counter<string>;
  private ratingCacheOperationsCounter: Counter<string>;
  private ratingBulkOperationsCounter: Counter<string>;

  // Гистограммы для времени выполнения
  private ratingCalculationDuration: Histogram<string>;
  private ratingCacheOperationDuration: Histogram<string>;
  private ratingBulkOperationDuration: Histogram<string>;

  // Gauge для текущих метрик
  private activeRatingCalculations: Gauge<string>;
  private cachedRatingsCount: Gauge<string>;
  private averageRatingCalculationTime: Gauge<string>;
  private cacheHitRatio: Gauge<string>;
  private ratingSystemLoad: Gauge<string>;

  // Счетчики для webhook операций
  private webhooksReceivedCounter: Counter<string>;
  private webhooksProcessedCounter: Counter<string>;
  private webhookErrorsCounter: Counter<string>;

  constructor() {
    // Очищаем существующие метрики в режиме разработки
    if (process.env.NODE_ENV !== 'production') {
      register.clear();
    }

    // Инициализируем метрики
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    this.ratingCalculationsCounter = new Counter({
      name: 'rating_calculations_total',
      help: 'Total number of rating calculations performed',
      labelNames: ['game_id', 'operation_type'],
    });

    this.ratingCacheOperationsCounter = new Counter({
      name: 'rating_cache_operations_total',
      help: 'Total number of rating cache operations',
      labelNames: ['operation', 'result'],
    });

    this.ratingBulkOperationsCounter = new Counter({
      name: 'rating_bulk_operations_total',
      help: 'Total number of bulk rating operations',
      labelNames: ['operation_type', 'status'],
    });

    this.ratingCalculationDuration = new Histogram({
      name: 'rating_calculation_duration_seconds',
      help: 'Duration of rating calculations in seconds',
      labelNames: ['game_id'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });

    this.ratingCacheOperationDuration = new Histogram({
      name: 'rating_cache_operation_duration_seconds',
      help: 'Duration of rating cache operations in seconds',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    });

    this.ratingBulkOperationDuration = new Histogram({
      name: 'rating_bulk_operation_duration_seconds',
      help: 'Duration of bulk rating operations in seconds',
      labelNames: ['operation_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    });

    this.activeRatingCalculations = new Gauge({
      name: 'active_rating_calculations',
      help: 'Number of currently active rating calculations',
    });

    this.cachedRatingsCount = new Gauge({
      name: 'cached_ratings_count',
      help: 'Number of ratings currently in cache',
    });

    this.averageRatingCalculationTime = new Gauge({
      name: 'average_rating_calculation_time_seconds',
      help: 'Average time for rating calculations in seconds',
    });

    this.cacheHitRatio = new Gauge({
      name: 'rating_cache_hit_ratio',
      help: 'Cache hit ratio for rating operations (0-1)',
    });

    this.ratingSystemLoad = new Gauge({
      name: 'rating_system_load',
      help: 'Current load of the rating system (0-1)',
    });

    this.webhooksReceivedCounter = new Counter({
      name: 'webhooks_received_total',
      help: 'Total number of webhooks received',
      labelNames: ['service', 'type'],
    });

    this.webhooksProcessedCounter = new Counter({
      name: 'webhooks_processed_total',
      help: 'Total number of webhooks processed',
      labelNames: ['service', 'status'],
    });

    this.webhookErrorsCounter = new Counter({
      name: 'webhook_errors_total',
      help: 'Total number of webhook processing errors',
      labelNames: ['service', 'error_type'],
    });
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

  recordBulkOperation(operationType: 'recalculate' | 'preload' | 'invalidate', status: 'success' | 'error'): void {
    this.ratingBulkOperationsCounter.inc({ operation_type: operationType, status });
  }

  recordBulkOperationDuration(operationType: string, duration: number): void {
    this.ratingBulkOperationDuration.observe({ operation_type: operationType }, duration);
  }

  updateCacheHitRatio(hitRatio: number): void {
    this.cacheHitRatio.set(Math.max(0, Math.min(1, hitRatio)));
  }

  updateRatingSystemLoad(load: number): void {
    this.ratingSystemLoad.set(Math.max(0, Math.min(1, load)));
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

  // Методы для отслеживания webhook операций
  recordWebhookReceived(service: string, type: string): void {
    this.webhooksReceivedCounter.inc({ service, type });
  }

  recordWebhookProcessed(service: string, status: string): void {
    this.webhooksProcessedCounter.inc({ service, status });
  }

  recordWebhookError(service: string, errorType: string): void {
    this.webhookErrorsCounter.inc({ service, error_type: errorType });
  }

  // Метод для получения сводной статистики webhook
  async getWebhookMetricsSummary(): Promise<{
    webhooksReceived: Record<string, number>;
    webhooksProcessed: Record<string, number>;
    webhookErrors: Record<string, number>;
  }> {
    const receivedMetric = register.getSingleMetric('webhooks_received_total') as Counter<string>;
    const processedMetric = register.getSingleMetric('webhooks_processed_total') as Counter<string>;
    const errorsMetric = register.getSingleMetric('webhook_errors_total') as Counter<string>;

    const webhooksReceived: Record<string, number> = {};
    const webhooksProcessed: Record<string, number> = {};
    const webhookErrors: Record<string, number> = {};

    if (receivedMetric) {
      const receivedData = await receivedMetric.get();
      receivedData.values.forEach(value => {
        const service = value.labels.service as string;
        webhooksReceived[service] = (webhooksReceived[service] || 0) + value.value;
      });
    }

    if (processedMetric) {
      const processedData = await processedMetric.get();
      processedData.values.forEach(value => {
        const service = value.labels.service as string;
        webhooksProcessed[service] = (webhooksProcessed[service] || 0) + value.value;
      });
    }

    if (errorsMetric) {
      const errorsData = await errorsMetric.get();
      errorsData.values.forEach(value => {
        const service = value.labels.service as string;
        webhookErrors[service] = (webhookErrors[service] || 0) + value.value;
      });
    }

    return {
      webhooksReceived,
      webhooksProcessed,
      webhookErrors,
    };
  }

  // Метод для сброса метрик (для тестирования)
  resetMetrics(): void {
    register.clear();
    this.logger.debug('All metrics have been reset');
  }

  // Метод для безопасного завершения работы
  onModuleDestroy(): void {
    if (process.env.NODE_ENV !== 'production') {
      register.clear();
    }
  }
}