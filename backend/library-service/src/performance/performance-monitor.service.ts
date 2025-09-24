import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CacheService } from '../cache/cache.service';

export interface PerformanceMetrics {
  timestamp: Date;
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  userId?: string;
  queryCount: number;
  cacheHits: number;
  cacheMisses: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage?: number;
}

export interface DatabaseMetrics {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  connectionPoolUtilization: number;
  slowQueries: Array<{
    query: string;
    duration: number;
    timestamp: Date;
  }>;
  queryStats: {
    totalQueries: number;
    averageQueryTime: number;
    slowestQuery: number;
    fastestQuery: number;
  };
}

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  totalOperations: number;
  averageResponseTime: number;
  memoryUsage: number;
  keyCount: number;
  evictionCount: number;
}

export interface SystemMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  uptime: number;
  eventLoopDelay: number;
  gcStats?: {
    totalGCTime: number;
    gcCount: number;
    lastGCDuration: number;
  };
}

@Injectable()
export class PerformanceMonitorService {
  private readonly logger = new Logger(PerformanceMonitorService.name);
  private metrics: PerformanceMetrics[] = [];
  private readonly maxMetricsHistory = 10000;
  private queryCount = 0;
  private slowQueryThreshold = 1000; // 1 second
  private slowQueries: Array<{
    query: string;
    duration: number;
    timestamp: Date;
  }> = [];
  private readonly startTime = Date.now();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
  ) {
    this.setupQueryLogging();
    this.startPeriodicMetricsCollection();
  }

  /**
   * Record performance metrics for an HTTP request
   */
  recordRequestMetrics(metrics: Partial<PerformanceMetrics>): void {
    const fullMetrics: PerformanceMetrics = {
      timestamp: new Date(),
      endpoint: metrics.endpoint || 'unknown',
      method: metrics.method || 'GET',
      responseTime: metrics.responseTime || 0,
      statusCode: metrics.statusCode || 200,
      userId: metrics.userId,
      queryCount: this.queryCount,
      cacheHits: 0,
      cacheMisses: 0,
      memoryUsage: process.memoryUsage(),
      ...metrics,
    };

    this.metrics.push(fullMetrics);

    // Keep only recent metrics to prevent memory leaks
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Log slow requests
    if (fullMetrics.responseTime > 1000) {
      this.logger.warn(
        `Slow request detected: ${fullMetrics.method} ${fullMetrics.endpoint} - ${fullMetrics.responseTime}ms`,
      );
    }

    // Log error responses
    if (fullMetrics.statusCode >= 400) {
      this.logger.error(
        `Error response: ${fullMetrics.method} ${fullMetrics.endpoint} - ${fullMetrics.statusCode}`,
      );
    }
  }

  /**
   * Get current database performance metrics
   */
  async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      // Get connection pool stats
      const poolStats = await this.getConnectionPoolStats();

      // Get query statistics
      const queryStats = this.getQueryStatistics();

      return {
        activeConnections: poolStats.active,
        idleConnections: poolStats.idle,
        totalConnections: poolStats.total,
        connectionPoolUtilization: poolStats.utilization,
        slowQueries: this.slowQueries.slice(-10), // Last 10 slow queries
        queryStats,
      };
    } catch (error) {
      this.logger.error('Failed to get database metrics:', error);
      return {
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        connectionPoolUtilization: 0,
        slowQueries: [],
        queryStats: {
          totalQueries: 0,
          averageQueryTime: 0,
          slowestQuery: 0,
          fastestQuery: 0,
        },
      };
    }
  }

  /**
   * Get current cache performance metrics
   */
  async getCacheMetrics(): Promise<CacheMetrics> {
    try {
      const cacheStats = this.cacheService.getStats();

      return {
        hitRate: cacheStats.hitRate,
        missRate: 1 - cacheStats.hitRate,
        totalOperations: cacheStats.totalOperations,
        averageResponseTime: 0, // Would need to be tracked separately
        memoryUsage: 0, // Would need Redis INFO command
        keyCount: 0, // Would need Redis DBSIZE command
        evictionCount: 0, // Would need Redis INFO command
      };
    } catch (error) {
      this.logger.error('Failed to get cache metrics:', error);
      return {
        hitRate: 0,
        missRate: 1,
        totalOperations: 0,
        averageResponseTime: 0,
        memoryUsage: 0,
        keyCount: 0,
        evictionCount: 0,
      };
    }
  }

  /**
   * Get current system performance metrics
   */
  getSystemMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      memoryUsage,
      cpuUsage: this.getCpuUsage(),
      uptime,
      eventLoopDelay: this.getEventLoopDelay(),
      gcStats: this.getGCStats(),
    };
  }

  /**
   * Get performance summary for the last N minutes
   */
  getPerformanceSummary(minutes: number = 5): {
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
    slowRequestCount: number;
    topSlowEndpoints: Array<{
      endpoint: string;
      averageTime: number;
      count: number;
    }>;
    statusCodeDistribution: Record<number, number>;
  } {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    const recentMetrics = this.metrics.filter((m) => m.timestamp >= cutoffTime);

    if (recentMetrics.length === 0) {
      return {
        requestCount: 0,
        averageResponseTime: 0,
        errorRate: 0,
        slowRequestCount: 0,
        topSlowEndpoints: [],
        statusCodeDistribution: {},
      };
    }

    const requestCount = recentMetrics.length;
    const averageResponseTime =
      recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / requestCount;
    const errorCount = recentMetrics.filter((m) => m.statusCode >= 400).length;
    const errorRate = errorCount / requestCount;
    const slowRequestCount = recentMetrics.filter(
      (m) => m.responseTime > 1000,
    ).length;

    // Group by endpoint for slow endpoint analysis
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
        averageTime: stats.totalTime / stats.count,
        count: stats.count,
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10);

    // Status code distribution
    const statusCodeDistribution: Record<number, number> = {};
    recentMetrics.forEach((m) => {
      statusCodeDistribution[m.statusCode] =
        (statusCodeDistribution[m.statusCode] || 0) + 1;
    });

    return {
      requestCount,
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      slowRequestCount,
      topSlowEndpoints,
      statusCodeDistribution,
    };
  }

  /**
   * Get detailed performance report
   */
  async getDetailedPerformanceReport(): Promise<{
    system: SystemMetrics;
    database: DatabaseMetrics;
    cache: CacheMetrics;
    requests: {
      requestCount: number;
      averageResponseTime: number;
      errorRate: number;
      slowRequestCount: number;
      topSlowEndpoints: Array<{
        endpoint: string;
        averageTime: number;
        count: number;
      }>;
      statusCodeDistribution: Record<number, number>;
    };
    recommendations: string[];
  }> {
    const [system, database, cache] = await Promise.all([
      this.getSystemMetrics(),
      this.getDatabaseMetrics(),
      this.getCacheMetrics(),
    ]);

    const requests = this.getPerformanceSummary(15); // Last 15 minutes

    const recommendations = this.generatePerformanceRecommendations({
      system,
      database,
      cache,
      requests,
    });

    return {
      system,
      database,
      cache,
      requests,
      recommendations,
    };
  }

  /**
   * Check if system is performing within acceptable thresholds
   */
  async performHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    metrics: {
      responseTime: number;
      errorRate: number;
      memoryUsage: number;
      cpuUsage: number;
      dbConnections: number;
      cacheHitRate: number;
    };
  }> {
    const summary = this.getPerformanceSummary(5);
    const system = this.getSystemMetrics();
    const database = await this.getDatabaseMetrics();
    const cache = await this.getCacheMetrics();

    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check response time
    if (summary.averageResponseTime > 1000) {
      issues.push(
        `High average response time: ${summary.averageResponseTime}ms`,
      );
      status = 'critical';
    } else if (summary.averageResponseTime > 500) {
      issues.push(`Elevated response time: ${summary.averageResponseTime}ms`);
      if (status === 'healthy') status = 'warning';
    }

    // Check error rate
    if (summary.errorRate > 0.05) {
      issues.push(`High error rate: ${(summary.errorRate * 100).toFixed(2)}%`);
      status = 'critical';
    } else if (summary.errorRate > 0.01) {
      issues.push(
        `Elevated error rate: ${(summary.errorRate * 100).toFixed(2)}%`,
      );
      if (status === 'healthy') status = 'warning';
    }

    // Check memory usage
    const memoryUsagePercent =
      (system.memoryUsage.heapUsed / system.memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 90) {
      issues.push(`Critical memory usage: ${memoryUsagePercent.toFixed(1)}%`);
      status = 'critical';
    } else if (memoryUsagePercent > 80) {
      issues.push(`High memory usage: ${memoryUsagePercent.toFixed(1)}%`);
      if (status === 'healthy') status = 'warning';
    }

    // Check database connections
    if (database.connectionPoolUtilization > 90) {
      issues.push(
        `High database connection pool utilization: ${database.connectionPoolUtilization.toFixed(1)}%`,
      );
      status = 'critical';
    } else if (database.connectionPoolUtilization > 80) {
      issues.push(
        `Elevated database connection pool utilization: ${database.connectionPoolUtilization.toFixed(1)}%`,
      );
      if (status === 'healthy') status = 'warning';
    }

    // Check cache hit rate
    if (cache.hitRate < 0.5) {
      issues.push(`Low cache hit rate: ${(cache.hitRate * 100).toFixed(1)}%`);
      if (status === 'healthy') status = 'warning';
    }

    return {
      status,
      issues,
      metrics: {
        responseTime: summary.averageResponseTime,
        errorRate: summary.errorRate,
        memoryUsage: memoryUsagePercent,
        cpuUsage: system.cpuUsage,
        dbConnections: database.connectionPoolUtilization,
        cacheHitRate: cache.hitRate,
      },
    };
  }

  /**
   * Setup query logging for performance monitoring
   */
  private setupQueryLogging(): void {
    // This would typically be done through TypeORM logging configuration
    // For now, we'll track query count
    const originalQuery = this.dataSource.query.bind(this.dataSource);

    this.dataSource.query = async (
      query: string,
      parameters?: any[],
    ): Promise<any> => {
      const startTime = Date.now();
      this.queryCount++;

      try {
        const result = await originalQuery(query, parameters);
        const duration = Date.now() - startTime;

        if (duration > this.slowQueryThreshold) {
          this.slowQueries.push({
            query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
            duration,
            timestamp: new Date(),
          });

          // Keep only recent slow queries
          if (this.slowQueries.length > 100) {
            this.slowQueries = this.slowQueries.slice(-100);
          }
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.logger.error(
          `Query failed after ${duration}ms: ${query.substring(0, 100)}...`,
        );
        throw error;
      }
    };
  }

  /**
   * Start periodic metrics collection
   */
  private startPeriodicMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      const metrics = this.getSystemMetrics();

      // Log warnings for high resource usage
      const memoryUsagePercent =
        (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
      if (memoryUsagePercent > 85) {
        this.logger.warn(
          `High memory usage: ${memoryUsagePercent.toFixed(1)}%`,
        );
      }

      if (metrics.cpuUsage > 80) {
        this.logger.warn(`High CPU usage: ${metrics.cpuUsage.toFixed(1)}%`);
      }

      if (metrics.eventLoopDelay > 100) {
        this.logger.warn(`High event loop delay: ${metrics.eventLoopDelay}ms`);
      }
    }, 30000);
  }

  /**
   * Get connection pool statistics
   */
  private async getConnectionPoolStats(): Promise<{
    active: number;
    idle: number;
    total: number;
    utilization: number;
  }> {
    try {
      // This is a simplified implementation
      // In a real scenario, you'd query the actual connection pool
      const pool = (this.dataSource.driver as any).pool;

      if (pool) {
        const active = pool.numUsed || 0;
        const idle = pool.numFree || 0;
        const total = active + idle;
        const utilization = total > 0 ? (active / total) * 100 : 0;

        return { active, idle, total, utilization };
      }
    } catch (error) {
      this.logger.error('Failed to get connection pool stats:', error);
    }

    return { active: 0, idle: 0, total: 0, utilization: 0 };
  }

  /**
   * Get query statistics
   */
  private getQueryStatistics(): DatabaseMetrics['queryStats'] {
    const recentSlowQueries = this.slowQueries.filter(
      (q) => q.timestamp > new Date(Date.now() - 5 * 60 * 1000),
    );

    if (recentSlowQueries.length === 0) {
      return {
        totalQueries: this.queryCount,
        averageQueryTime: 0,
        slowestQuery: 0,
        fastestQuery: 0,
      };
    }

    const durations = recentSlowQueries.map((q) => q.duration);
    const averageQueryTime =
      durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const slowestQuery = Math.max(...durations);
    const fastestQuery = Math.min(...durations);

    return {
      totalQueries: this.queryCount,
      averageQueryTime: Math.round(averageQueryTime),
      slowestQuery,
      fastestQuery,
    };
  }

  /**
   * Get CPU usage percentage
   */
  private getCpuUsage(): number {
    // This is a simplified implementation
    // In production, you'd use a proper CPU monitoring library
    const usage = process.cpuUsage();
    return ((usage.user + usage.system) / 1000000) * 100; // Convert to percentage
  }

  /**
   * Get event loop delay
   */
  private getEventLoopDelay(): number {
    // This would typically use perf_hooks.monitorEventLoopDelay()
    // For now, return a placeholder
    return 0;
  }

  /**
   * Get garbage collection statistics
   */
  private getGCStats(): SystemMetrics['gcStats'] {
    // This would typically use perf_hooks for GC monitoring
    // For now, return undefined
    return undefined;
  }

  /**
   * Generate performance recommendations based on current metrics
   */
  private generatePerformanceRecommendations(metrics: {
    system: SystemMetrics;
    database: DatabaseMetrics;
    cache: CacheMetrics;
    requests: {
      requestCount: number;
      averageResponseTime: number;
      errorRate: number;
      slowRequestCount: number;
      topSlowEndpoints: Array<{
        endpoint: string;
        averageTime: number;
        count: number;
      }>;
      statusCodeDistribution: Record<number, number>;
    };
  }): string[] {
    const recommendations: string[] = [];

    // Memory recommendations
    const memoryUsagePercent =
      (metrics.system.memoryUsage.heapUsed /
        metrics.system.memoryUsage.heapTotal) *
      100;
    if (memoryUsagePercent > 80) {
      recommendations.push(
        'Consider increasing heap size or optimizing memory usage',
      );
    }

    // Database recommendations
    if (metrics.database.connectionPoolUtilization > 80) {
      recommendations.push('Consider increasing database connection pool size');
    }

    if (metrics.database.slowQueries.length > 5) {
      recommendations.push(
        'Optimize slow database queries or add missing indexes',
      );
    }

    // Cache recommendations
    if (metrics.cache.hitRate < 0.7) {
      recommendations.push(
        'Improve cache hit rate by optimizing cache keys and TTL values',
      );
    }

    // Request recommendations
    if (metrics.requests.averageResponseTime > 500) {
      recommendations.push(
        'Optimize slow endpoints or add caching for frequently accessed data',
      );
    }

    if (metrics.requests.errorRate > 0.02) {
      recommendations.push(
        'Investigate and fix sources of errors to improve reliability',
      );
    }

    return recommendations;
  }
}
