import { Injectable, Logger } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge, register } from 'prom-client';

/**
 * Metrics Service for User Service
 * Provides comprehensive metrics collection for operations, cache, batch operations, and system health
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    // User operations metrics
    @InjectMetric('user_operations_total')
    private readonly userOperationsCounter: Counter<string>,

    @InjectMetric('user_operations_duration_seconds')
    private readonly userOperationsDuration: Histogram<string>,

    // Cache metrics
    @InjectMetric('user_cache_hits_total')
    private readonly cacheHitsCounter: Counter<string>,

    @InjectMetric('user_cache_misses_total')
    private readonly cacheMissesCounter: Counter<string>,

    @InjectMetric('user_cache_operations_duration_seconds')
    private readonly cacheOperationsDuration: Histogram<string>,

    // Batch operations metrics
    @InjectMetric('user_batch_operations_total')
    private readonly batchOperationsCounter: Counter<string>,

    @InjectMetric('user_batch_operations_duration_seconds')
    private readonly batchOperationsDuration: Histogram<string>,

    @InjectMetric('user_batch_items_processed_total')
    private readonly batchItemsProcessedCounter: Counter<string>,

    // External service calls metrics
    @InjectMetric('user_external_service_calls_total')
    private readonly externalServiceCallsCounter: Counter<string>,

    @InjectMetric('user_external_service_calls_duration_seconds')
    private readonly externalServiceCallsDuration: Histogram<string>,

    // Database metrics
    @InjectMetric('user_database_operations_total')
    private readonly databaseOperationsCounter: Counter<string>,

    @InjectMetric('user_database_operations_duration_seconds')
    private readonly databaseOperationsDuration: Histogram<string>,

    @InjectMetric('user_database_slow_queries_total')
    private readonly slowQueriesCounter: Counter<string>,

    // System metrics
    @InjectMetric('user_service_active_connections')
    private readonly activeConnectionsGauge: Gauge<string>,

    @InjectMetric('user_service_memory_usage_bytes')
    private readonly memoryUsageGauge: Gauge<string>,

    @InjectMetric('user_service_database_pool_size')
    private readonly databasePoolSizeGauge: Gauge<string>,
  ) {
    this.logger.log('MetricsService initialized with custom metrics');
  }

  /**
   * Record user operation metrics
   */
  recordUserOperation(
    operation: string,
    status: 'success' | 'error',
    duration?: number,
  ): void {
    try {
      this.userOperationsCounter.inc({ operation, status });

      if (duration !== undefined) {
        this.userOperationsDuration.observe(
          { operation, status },
          duration / 1000,
        ); // Convert to seconds
      }
    } catch (error) {
      this.logger.error('Error recording user operation metrics:', error);
    }
  }

  /**
   * Record cache operation metrics
   */
  recordCacheOperation(
    operation: 'hit' | 'miss',
    cacheType: string,
    duration?: number,
  ): void {
    try {
      if (operation === 'hit') {
        this.cacheHitsCounter.inc({ cache_type: cacheType });
      } else {
        this.cacheMissesCounter.inc({ cache_type: cacheType });
      }

      if (duration !== undefined) {
        this.cacheOperationsDuration.observe(
          { operation, cache_type: cacheType },
          duration / 1000,
        );
      }
    } catch (error) {
      this.logger.error('Error recording cache operation metrics:', error);
    }
  }

  /**
   * Record batch operation metrics
   */
  recordBatchOperation(
    operation: string,
    status: 'success' | 'error',
    itemsCount: number,
    duration?: number,
  ): void {
    try {
      this.batchOperationsCounter.inc({ operation, status });
      this.batchItemsProcessedCounter.inc({ operation, status }, itemsCount);

      if (duration !== undefined) {
        this.batchOperationsDuration.observe(
          { operation, status },
          duration / 1000,
        );
      }
    } catch (error) {
      this.logger.error('Error recording batch operation metrics:', error);
    }
  }

  /**
   * Record external service call metrics
   */
  recordExternalServiceCall(
    service: string,
    operation: string,
    status: 'success' | 'error' | 'timeout',
    duration?: number,
  ): void {
    try {
      this.externalServiceCallsCounter.inc({ service, operation, status });

      if (duration !== undefined) {
        this.externalServiceCallsDuration.observe(
          { service, operation, status },
          duration / 1000,
        );
      }
    } catch (error) {
      this.logger.error(
        'Error recording external service call metrics:',
        error,
      );
    }
  }

  /**
   * Record database operation metrics
   */
  recordDatabaseOperation(
    operation: string,
    table: string,
    status: 'success' | 'error',
    duration?: number,
  ): void {
    try {
      this.databaseOperationsCounter.inc({ operation, table, status });

      if (duration !== undefined) {
        this.databaseOperationsDuration.observe(
          { operation, table, status },
          duration / 1000,
        );
      }
    } catch (error) {
      this.logger.error('Error recording database operation metrics:', error);
    }
  }

  /**
   * Record slow query metrics
   */
  recordSlowQuery(query_type: string, table: string, duration: number): void {
    try {
      this.slowQueriesCounter.inc({ query_type, table });
      this.logger.warn(
        `Slow query detected: ${query_type} on ${table} took ${duration}ms`,
      );
    } catch (error) {
      this.logger.error('Error recording slow query metrics:', error);
    }
  }

  /**
   * Update system metrics
   */
  updateSystemMetrics(metrics: {
    activeConnections?: number;
    memoryUsage?: number;
    databasePoolSize?: number;
  }): void {
    try {
      if (metrics.activeConnections !== undefined) {
        this.activeConnectionsGauge.set(metrics.activeConnections);
      }

      if (metrics.memoryUsage !== undefined) {
        this.memoryUsageGauge.set(metrics.memoryUsage);
      }

      if (metrics.databasePoolSize !== undefined) {
        this.databasePoolSizeGauge.set(metrics.databasePoolSize);
      }
    } catch (error) {
      this.logger.error('Error updating system metrics:', error);
    }
  }

  /**
   * Get current cache hit rate
   */
  async getCacheHitRate(cacheType?: string): Promise<number> {
    try {
      const hits = await this.getCacheHits(cacheType);
      const misses = await this.getCacheMisses(cacheType);
      const total = hits + misses;

      return total > 0 ? (hits / total) * 100 : 0;
    } catch (error) {
      this.logger.error('Error calculating cache hit rate:', error);
      return 0;
    }
  }

  /**
   * Get cache hits count
   */
  private async getCacheHits(cacheType?: string): Promise<number> {
    try {
      const metric = register.getSingleMetric(
        'user_service_user_cache_hits_total',
      ) as Counter<string>;
      if (!metric) return 0;

      const values = await metric.get();
      if (!values.values) return 0;

      return values.values
        .filter((v) => !cacheType || v.labels.cache_type === cacheType)
        .reduce((sum, v) => sum + v.value, 0);
    } catch (error) {
      this.logger.error('Error getting cache hits:', error);
      return 0;
    }
  }

  /**
   * Get cache misses count
   */
  private async getCacheMisses(cacheType?: string): Promise<number> {
    try {
      const metric = register.getSingleMetric(
        'user_service_user_cache_misses_total',
      ) as Counter<string>;
      if (!metric) return 0;

      const values = await metric.get();
      if (!values.values) return 0;

      return values.values
        .filter((v) => !cacheType || v.labels.cache_type === cacheType)
        .reduce((sum, v) => sum + v.value, 0);
    } catch (error) {
      this.logger.error('Error getting cache misses:', error);
      return 0;
    }
  }

  /**
   * Get metrics summary for health checks
   */
  async getMetricsSummary(): Promise<{
    userOperations: number;
    cacheHitRate: number;
    batchOperations: number;
    externalServiceCalls: number;
    slowQueries: number;
  }> {
    try {
      const [
        userOperations,
        cacheHitRate,
        batchOperations,
        externalServiceCalls,
        slowQueries,
      ] = await Promise.all([
        this.getMetricValue('user_service_user_operations_total'),
        this.getCacheHitRate(),
        this.getMetricValue('user_service_user_batch_operations_total'),
        this.getMetricValue('user_service_user_external_service_calls_total'),
        this.getMetricValue('user_service_user_database_slow_queries_total'),
      ]);

      return {
        userOperations,
        cacheHitRate,
        batchOperations,
        externalServiceCalls,
        slowQueries,
      };
    } catch (error) {
      this.logger.error('Error getting metrics summary:', error);
      return {
        userOperations: 0,
        cacheHitRate: 0,
        batchOperations: 0,
        externalServiceCalls: 0,
        slowQueries: 0,
      };
    }
  }

  /**
   * Get metric value by name
   */
  private async getMetricValue(metricName: string): Promise<number> {
    try {
      const metric = register.getSingleMetric(metricName);
      if (!metric) return 0;

      const values = await metric.get();
      if (!values.values) return 0;

      return values.values.reduce((sum, v) => sum + v.value, 0);
    } catch (error) {
      this.logger.error(`Error getting metric value for ${metricName}:`, error);
      return 0;
    }
  }

  /**
   * Reset all metrics (useful for testing)
   */
  resetMetrics(): void {
    try {
      register.clear();
      this.logger.log('All metrics have been reset');
    } catch (error) {
      this.logger.error('Error resetting metrics:', error);
    }
  }
}
