import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { MetricsService } from '../common/metrics/metrics.service';

export interface SlowQueryLog {
  query: string;
  parameters?: any[];
  duration: number;
  timestamp: Date;
  repository?: string;
  stackTrace?: string;
}

export interface SlowQueryStats {
  totalSlowQueries: number;
  averageDuration: number;
  slowestQuery: SlowQueryLog | null;
  queriesOverThreshold: SlowQueryLog[];
  topSlowQueries: Array<{
    query: string;
    count: number;
    averageDuration: number;
    maxDuration: number;
  }>;
}

/**
 * Slow Query Monitor Service
 * Monitors and logs slow database queries for performance optimization
 */
@Injectable()
export class SlowQueryMonitorService {
  private readonly logger = new Logger(SlowQueryMonitorService.name);
  private readonly slowQueries: SlowQueryLog[] = [];
  private readonly queryStats = new Map<
    string,
    {
      count: number;
      totalDuration: number;
      maxDuration: number;
    }
  >();

  private readonly slowQueryThreshold: number;
  private readonly maxStoredQueries = 1000; // Limit memory usage

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
    @Inject(forwardRef(() => MetricsService))
    private readonly metricsService?: MetricsService,
  ) {
    this.slowQueryThreshold = this.configService.get('SLOW_QUERY_THRESHOLD', {
      infer: true,
    });
    this.logger.log(
      `Slow query monitoring initialized with threshold: ${this.slowQueryThreshold}ms`,
    );
  }

  /**
   * Log a slow query
   */
  logSlowQuery(slowQuery: SlowQueryLog): void {
    // Only log if duration exceeds threshold
    if (slowQuery.duration < this.slowQueryThreshold) {
      return;
    }

    // Add to slow queries list
    this.slowQueries.push(slowQuery);

    // Maintain memory limit
    if (this.slowQueries.length > this.maxStoredQueries) {
      this.slowQueries.shift(); // Remove oldest
    }

    // Update statistics
    this.updateQueryStats(slowQuery);

    // Log the slow query
    this.logger.warn('Slow query detected', {
      duration: `${slowQuery.duration}ms`,
      query: this.truncateQuery(slowQuery.query),
      parameters: slowQuery.parameters,
      repository: slowQuery.repository,
      timestamp: slowQuery.timestamp.toISOString(),
    });

    // Record metrics for slow query
    const queryType = this.getQueryType(slowQuery.query);
    const table = this.extractTableName(slowQuery.query);
    this.metricsService?.recordSlowQuery(queryType, table, slowQuery.duration);

    // Log critical slow queries (> 5 seconds)
    if (slowQuery.duration > 5000) {
      this.logger.error('Critical slow query detected', {
        duration: `${slowQuery.duration}ms`,
        query: this.truncateQuery(slowQuery.query),
        parameters: slowQuery.parameters,
        repository: slowQuery.repository,
        stackTrace: slowQuery.stackTrace,
      });
    }
  }

  /**
   * Get slow query statistics
   */
  getSlowQueryStats(): SlowQueryStats {
    if (this.slowQueries.length === 0) {
      return {
        totalSlowQueries: 0,
        averageDuration: 0,
        slowestQuery: null,
        queriesOverThreshold: [],
        topSlowQueries: [],
      };
    }

    const totalDuration = this.slowQueries.reduce(
      (sum, query) => sum + query.duration,
      0,
    );
    const averageDuration = totalDuration / this.slowQueries.length;

    const slowestQuery = this.slowQueries.reduce((slowest, current) =>
      current.duration > slowest.duration ? current : slowest,
    );

    // Get queries over critical threshold (2x the configured threshold)
    const criticalThreshold = this.slowQueryThreshold * 2;
    const queriesOverThreshold = this.slowQueries.filter(
      (query) => query.duration > criticalThreshold,
    );

    // Get top slow queries by frequency and duration
    const topSlowQueries = Array.from(this.queryStats.entries())
      .map(([query, stats]) => ({
        query: this.truncateQuery(query),
        count: stats.count,
        averageDuration: stats.totalDuration / stats.count,
        maxDuration: stats.maxDuration,
      }))
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 10);

    return {
      totalSlowQueries: this.slowQueries.length,
      averageDuration,
      slowestQuery,
      queriesOverThreshold,
      topSlowQueries,
    };
  }

  /**
   * Get recent slow queries
   */
  getRecentSlowQueries(limit: number = 50): SlowQueryLog[] {
    return this.slowQueries
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clear slow query logs
   */
  clearSlowQueryLogs(): void {
    this.slowQueries.length = 0;
    this.queryStats.clear();
    this.logger.log('Slow query logs cleared');
  }

  /**
   * Get queries by repository
   */
  getSlowQueriesByRepository(repository: string): SlowQueryLog[] {
    return this.slowQueries.filter((query) => query.repository === repository);
  }

  /**
   * Check if query should be monitored
   */
  shouldMonitorQuery(query: string): boolean {
    const normalizedQuery = query.toLowerCase().trim();

    // Don't monitor very short queries
    if (normalizedQuery.length < 10) {
      return false;
    }

    // Don't monitor system queries
    if (
      normalizedQuery.includes('information_schema') ||
      normalizedQuery.includes('pg_catalog') ||
      normalizedQuery.includes('pg_stat')
    ) {
      return false;
    }

    return true;
  }

  /**
   * Get slow query threshold
   */
  getSlowQueryThreshold(): number {
    return this.slowQueryThreshold;
  }

  /**
   * Update query statistics
   */
  private updateQueryStats(slowQuery: SlowQueryLog): void {
    const normalizedQuery = this.normalizeQuery(slowQuery.query);

    if (!this.queryStats.has(normalizedQuery)) {
      this.queryStats.set(normalizedQuery, {
        count: 0,
        totalDuration: 0,
        maxDuration: 0,
      });
    }

    const stats = this.queryStats.get(normalizedQuery);
    stats.count++;
    stats.totalDuration += slowQuery.duration;
    stats.maxDuration = Math.max(stats.maxDuration, slowQuery.duration);
  }

  /**
   * Normalize query for statistics (remove parameters and whitespace)
   */
  private normalizeQuery(query: string): string {
    return query
      .replace(/\$\d+/g, '?') // Replace PostgreSQL parameters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();
  }

  /**
   * Get query type from SQL query
   */
  private getQueryType(query: string): string {
    const normalizedQuery = query.toLowerCase().trim();

    if (normalizedQuery.startsWith('select')) return 'select';
    if (normalizedQuery.startsWith('insert')) return 'insert';
    if (normalizedQuery.startsWith('update')) return 'update';
    if (normalizedQuery.startsWith('delete')) return 'delete';
    if (normalizedQuery.startsWith('with')) return 'cte';

    return 'unknown';
  }

  /**
   * Extract table name from SQL query
   */
  private extractTableName(query: string): string {
    const normalizedQuery = query.toLowerCase().trim();

    // Simple regex patterns for common cases
    let match = normalizedQuery.match(/from\s+(\w+)/);
    if (match) return match[1];

    match = normalizedQuery.match(/update\s+(\w+)/);
    if (match) return match[1];

    match = normalizedQuery.match(/insert\s+into\s+(\w+)/);
    if (match) return match[1];

    match = normalizedQuery.match(/delete\s+from\s+(\w+)/);
    if (match) return match[1];

    return 'unknown';
  }

  /**
   * Truncate query for display
   */
  private truncateQuery(query: string): string {
    return query.length > 200 ? `${query.substring(0, 200)}...` : query;
  }
}
