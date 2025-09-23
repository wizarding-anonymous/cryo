import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  cacheHit: boolean;
  queryCount?: number;
  responseSize: number;
  timestamp: Date;
  status: 'success' | 'error';
  error?: string;
}

export interface CacheMetrics {
  key: string;
  operation: 'get' | 'set' | 'del';
  hit: boolean;
  responseTime: number;
  timestamp: Date;
}

@Injectable()
export class PerformanceMonitoringService {
  private readonly logger = new Logger(PerformanceMonitoringService.name);
  private readonly isEnabled: boolean;
  private readonly slowQueryThreshold: number;
  private readonly metricsBuffer: PerformanceMetrics[] = [];
  private readonly cacheMetricsBuffer: CacheMetrics[] = [];
  private readonly maxBufferSize = 1000;

  constructor(private readonly configService: ConfigService) {
    this.isEnabled = this.configService.get<boolean>(
      'PERFORMANCE_MONITORING_ENABLED',
      true,
    );
    this.slowQueryThreshold = this.configService.get<number>(
      'SLOW_QUERY_THRESHOLD_MS',
      500,
    );
  }

  /**
   * Record performance metrics for an API endpoint
   */
  recordEndpointMetrics(metrics: PerformanceMetrics): void {
    if (!this.isEnabled) return;

    // Add to buffer
    this.metricsBuffer.push(metrics);
    this.trimBuffer(this.metricsBuffer, this.maxBufferSize);

    // Log slow requests
    if (metrics.responseTime > this.slowQueryThreshold) {
      this.logger.warn(
        `Slow request detected: ${metrics.method} ${metrics.endpoint} - ${metrics.responseTime}ms`,
      );
    }

    // Log errors
    if (metrics.status === 'error') {
      this.logger.error(
        `Request failed: ${metrics.method} ${metrics.endpoint} - ${metrics.error}`,
      );
    }

    // Log structured metrics for external monitoring
    this.logStructuredMetrics(metrics);
  }

  /**
   * Record cache operation metrics
   */
  recordCacheMetrics(metrics: CacheMetrics): void {
    if (!this.isEnabled) return;

    this.cacheMetricsBuffer.push(metrics);
    this.trimBuffer(this.cacheMetricsBuffer, this.maxBufferSize);

    // Log cache performance
    if (metrics.operation === 'get') {
      const status = metrics.hit ? 'HIT' : 'MISS';
      this.logger.debug(
        `Cache ${status}: ${metrics.key} (${metrics.responseTime}ms)`,
      );
    }
  }

  /**
   * Get performance statistics for the last N minutes
   */
  getPerformanceStats(minutes: number = 5): {
    totalRequests: number;
    averageResponseTime: number;
    slowRequests: number;
    errorRate: number;
    cacheHitRate: number;
    topSlowEndpoints: Array<{
      endpoint: string;
      avgResponseTime: number;
      count: number;
    }>;
  } {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    const recentMetrics = this.metricsBuffer.filter(
      (m) => m.timestamp > cutoffTime,
    );
    const recentCacheMetrics = this.cacheMetricsBuffer.filter(
      (m) => m.timestamp > cutoffTime,
    );

    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        slowRequests: 0,
        errorRate: 0,
        cacheHitRate: 0,
        topSlowEndpoints: [],
      };
    }

    // Calculate basic stats
    const totalRequests = recentMetrics.length;
    const averageResponseTime =
      recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;
    const slowRequests = recentMetrics.filter(
      (m) => m.responseTime > this.slowQueryThreshold,
    ).length;
    const errorRequests = recentMetrics.filter(
      (m) => m.status === 'error',
    ).length;
    const errorRate = (errorRequests / totalRequests) * 100;

    // Calculate cache hit rate
    const cacheGets = recentCacheMetrics.filter((m) => m.operation === 'get');
    const cacheHits = cacheGets.filter((m) => m.hit);
    const cacheHitRate =
      cacheGets.length > 0 ? (cacheHits.length / cacheGets.length) * 100 : 0;

    // Calculate top slow endpoints
    const endpointStats = new Map<
      string,
      { totalTime: number; count: number }
    >();
    recentMetrics.forEach((m) => {
      const key = `${m.method} ${m.endpoint}`;
      const existing = endpointStats.get(key) || { totalTime: 0, count: 0 };
      endpointStats.set(key, {
        totalTime: existing.totalTime + m.responseTime,
        count: existing.count + 1,
      });
    });

    const topSlowEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        avgResponseTime: stats.totalTime / stats.count,
        count: stats.count,
      }))
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, 5);

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      slowRequests,
      errorRate: Math.round(errorRate * 100) / 100,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      topSlowEndpoints,
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(minutes: number = 5): {
    totalOperations: number;
    hitRate: number;
    averageResponseTime: number;
    operationBreakdown: Record<string, number>;
  } {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    const recentMetrics = this.cacheMetricsBuffer.filter(
      (m) => m.timestamp > cutoffTime,
    );

    if (recentMetrics.length === 0) {
      return {
        totalOperations: 0,
        hitRate: 0,
        averageResponseTime: 0,
        operationBreakdown: {},
      };
    }

    const totalOperations = recentMetrics.length;
    const averageResponseTime =
      recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) /
      totalOperations;

    // Calculate hit rate for GET operations only
    const getOperations = recentMetrics.filter((m) => m.operation === 'get');
    const hits = getOperations.filter((m) => m.hit);
    const hitRate =
      getOperations.length > 0 ? (hits.length / getOperations.length) * 100 : 0;

    // Operation breakdown
    const operationBreakdown = recentMetrics.reduce(
      (acc, m) => {
        acc[m.operation] = (acc[m.operation] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalOperations,
      hitRate: Math.round(hitRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      operationBreakdown,
    };
  }

  /**
   * Clear all metrics buffers
   */
  clearMetrics(): void {
    this.metricsBuffer.length = 0;
    this.cacheMetricsBuffer.length = 0;
    this.logger.log('Performance metrics cleared');
  }

  private trimBuffer<T>(buffer: T[], maxSize: number): void {
    if (buffer.length > maxSize) {
      buffer.splice(0, buffer.length - maxSize);
    }
  }

  private logStructuredMetrics(metrics: PerformanceMetrics): void {
    const structuredLog = {
      timestamp: metrics.timestamp.toISOString(),
      service: 'game-catalog-service',
      endpoint: metrics.endpoint,
      method: metrics.method,
      responseTime: metrics.responseTime,
      cacheHit: metrics.cacheHit,
      responseSize: metrics.responseSize,
      status: metrics.status,
      ...(metrics.error && { error: metrics.error }),
      ...(metrics.queryCount && { queryCount: metrics.queryCount }),
    };

    // In production, this could be sent to monitoring systems like Prometheus, DataDog, etc.
    if (
      metrics.responseTime > this.slowQueryThreshold ||
      metrics.status === 'error'
    ) {
      this.logger.warn(`Performance alert: ${JSON.stringify(structuredLog)}`);
    } else {
      this.logger.debug(`Performance data: ${JSON.stringify(structuredLog)}`);
    }
  }
}
