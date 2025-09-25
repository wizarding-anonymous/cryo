import { Injectable } from '@nestjs/common';

export interface RatingMetrics {
  operationType: 'calculate' | 'update' | 'get' | 'cache_hit' | 'cache_miss' | 'bulk_recalculate';
  gameId?: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

@Injectable()
export class MetricsService {
  private metrics: RatingMetrics[] = [];
  private readonly maxMetrics = 1000; // Keep last 1000 metrics in memory

  recordMetric(metric: RatingMetrics): void {
    this.metrics.push(metric);
    
    // Keep only the last maxMetrics entries
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  async measureOperation<T>(
    operationType: RatingMetrics['operationType'],
    operation: () => Promise<T>,
    gameId?: string,
  ): Promise<T> {
    const startTime = Date.now();
    const timestamp = new Date();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      this.recordMetric({
        operationType,
        gameId,
        duration,
        timestamp,
        success: true,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.recordMetric({
        operationType,
        gameId,
        duration,
        timestamp,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }

  getMetrics(): RatingMetrics[] {
    return [...this.metrics];
  }

  getMetricsSummary(): {
    totalOperations: number;
    averageDuration: number;
    successRate: number;
    operationCounts: Record<string, number>;
    recentErrors: Array<{ error: string; timestamp: Date; operationType: string }>;
  } {
    if (this.metrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        successRate: 0,
        operationCounts: {},
        recentErrors: [],
      };
    }

    const totalOperations = this.metrics.length;
    const successfulOperations = this.metrics.filter(m => m.success).length;
    const averageDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations;
    const successRate = (successfulOperations / totalOperations) * 100;

    const operationCounts = this.metrics.reduce((counts, metric) => {
      counts[metric.operationType] = (counts[metric.operationType] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const recentErrors = this.metrics
      .filter(m => !m.success && m.error)
      .slice(-10) // Last 10 errors
      .map(m => ({
        error: m.error!,
        timestamp: m.timestamp,
        operationType: m.operationType,
      }));

    return {
      totalOperations,
      averageDuration: Math.round(averageDuration * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      operationCounts,
      recentErrors,
    };
  }

  clearMetrics(): void {
    this.metrics = [];
  }
}