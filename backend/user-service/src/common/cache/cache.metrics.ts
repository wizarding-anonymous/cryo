import { Injectable } from '@nestjs/common';
import { register, Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class CacheMetrics {
  // Cache operation counters
  private readonly cacheHitsTotal = new Counter({
    name: 'user_cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['cache_type', 'operation'],
    registers: [register],
  });

  private readonly cacheMissesTotal = new Counter({
    name: 'user_cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['cache_type', 'operation'],
    registers: [register],
  });

  private readonly cacheOperationsTotal = new Counter({
    name: 'user_cache_operations_total',
    help: 'Total number of cache operations',
    labelNames: ['cache_type', 'operation', 'status'],
    registers: [register],
  });

  // Cache operation duration
  private readonly cacheOperationDuration = new Histogram({
    name: 'user_cache_operation_duration_seconds',
    help: 'Duration of cache operations in seconds',
    labelNames: ['cache_type', 'operation'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
  });

  // Cache size metrics
  private readonly cacheSize = new Gauge({
    name: 'user_cache_size_keys',
    help: 'Number of keys in cache',
    labelNames: ['cache_type'],
    registers: [register],
  });

  private readonly cacheHitRatio = new Gauge({
    name: 'user_cache_hit_ratio',
    help: 'Cache hit ratio (0-1)',
    labelNames: ['cache_type'],
    registers: [register],
  });

  // Batch operation metrics
  private readonly batchOperationsTotal = new Counter({
    name: 'user_batch_operations_total',
    help: 'Total number of batch operations',
    labelNames: ['operation', 'status'],
    registers: [register],
  });

  private readonly batchOperationDuration = new Histogram({
    name: 'user_batch_operation_duration_seconds',
    help: 'Duration of batch operations in seconds',
    labelNames: ['operation'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    registers: [register],
  });

  private readonly batchSize = new Histogram({
    name: 'user_batch_size',
    help: 'Size of batch operations',
    labelNames: ['operation'],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
    registers: [register],
  });

  /**
   * Record cache hit
   */
  recordCacheHit(cacheType: string, operation: string): void {
    this.cacheHitsTotal.inc({ cache_type: cacheType, operation });
    this.cacheOperationsTotal.inc({
      cache_type: cacheType,
      operation,
      status: 'hit',
    });
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(cacheType: string, operation: string): void {
    this.cacheMissesTotal.inc({ cache_type: cacheType, operation });
    this.cacheOperationsTotal.inc({
      cache_type: cacheType,
      operation,
      status: 'miss',
    });
  }

  /**
   * Record cache operation duration
   */
  recordCacheOperationDuration(
    cacheType: string,
    operation: string,
    durationSeconds: number,
  ): void {
    this.cacheOperationDuration.observe(
      { cache_type: cacheType, operation },
      durationSeconds,
    );
  }

  /**
   * Update cache size
   */
  updateCacheSize(cacheType: string, size: number): void {
    this.cacheSize.set({ cache_type: cacheType }, size);
  }

  /**
   * Update cache hit ratio
   */
  updateCacheHitRatio(cacheType: string, ratio: number): void {
    this.cacheHitRatio.set({ cache_type: cacheType }, ratio);
  }

  /**
   * Record batch operation
   */
  recordBatchOperation(
    operation: string,
    status: 'success' | 'error',
    size: number,
    durationSeconds: number,
  ): void {
    this.batchOperationsTotal.inc({ operation, status });
    this.batchOperationDuration.observe({ operation }, durationSeconds);
    this.batchSize.observe({ operation }, size);
  }

  /**
   * Get cache operation timer
   */
  startCacheTimer(cacheType: string, operation: string) {
    return this.cacheOperationDuration.startTimer({
      cache_type: cacheType,
      operation,
    });
  }

  /**
   * Get batch operation timer
   */
  startBatchTimer(operation: string) {
    return this.batchOperationDuration.startTimer({ operation });
  }
}
