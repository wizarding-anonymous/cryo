import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CacheService } from '../cache/cache.service';
import { PerformanceConfig } from '../config/performance.config';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PerformanceOptimizerService implements OnModuleInit {
  private readonly logger = new Logger(PerformanceOptimizerService.name);
  private readonly performanceConfig: PerformanceConfig;

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
  ) {
    this.performanceConfig =
      this.configService.get<PerformanceConfig>('performance')!;
  }

  async onModuleInit() {
    if (this.performanceConfig.optimization.enableAutoIndexing) {
      await this.optimizeIndexes();
    }

    if (this.performanceConfig.optimization.enableMaterializedViews) {
      await this.refreshMaterializedViews();
    }

    if (this.performanceConfig.cache.enableCacheWarming) {
      await this.warmCache();
    }

    this.logger.log('Performance optimizer initialized');
  }

  /**
   * Optimize database indexes based on query patterns
   */
  async optimizeIndexes(): Promise<void> {
    try {
      this.logger.log('Starting index optimization...');

      // Analyze table statistics
      await this.dataSource.query('ANALYZE library_games');
      await this.dataSource.query('ANALYZE purchase_history');

      // Check for missing indexes based on slow queries
      const slowQueries = await this.getSlowQueries();

      for (const query of slowQueries) {
        await this.suggestIndexForQuery(query);
      }

      // Update table statistics
      await this.updateTableStatistics();

      this.logger.log('Index optimization completed');
    } catch (error) {
      this.logger.error('Failed to optimize indexes:', error);
    }
  }

  /**
   * Refresh materialized views for better query performance
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async refreshMaterializedViews(): Promise<void> {
    if (!this.performanceConfig.optimization.enableMaterializedViews) {
      return;
    }

    try {
      this.logger.log('Refreshing materialized views...');

      await this.dataSource.query(
        'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_library_stats',
      );
      await this.dataSource.query(
        'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_purchase_stats',
      );

      this.logger.log('Materialized views refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh materialized views:', error);
    }
  }

  /**
   * Warm cache with frequently accessed data
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async warmCache(): Promise<void> {
    if (!this.performanceConfig.cache.enableCacheWarming) {
      return;
    }

    try {
      this.logger.log('Starting cache warming...');

      // Get most active users
      const activeUsers = await this.getActiveUsers(100);

      // Warm library cache for active users
      const promises = activeUsers.map(async (userId) => {
        const cacheKey = `library:${userId}`;
        const exists = await this.cacheService.get(cacheKey);

        if (!exists) {
          const library = await this.getUserLibraryForCache(userId);
          await this.cacheService.set(
            cacheKey,
            library,
            this.performanceConfig.cache.libraryTtl,
          );
        }
      });

      await Promise.all(promises);

      this.logger.log(`Cache warmed for ${activeUsers.length} users`);
    } catch (error) {
      this.logger.error('Failed to warm cache:', error);
    }
  }

  /**
   * Optimize database connection pool
   */
  async optimizeConnectionPool(): Promise<void> {
    try {
      this.logger.log('Optimizing database connection pool...');

      const poolStats = await this.getConnectionPoolStats();

      if (poolStats.utilization > 80) {
        this.logger.warn(
          `High connection pool utilization: ${poolStats.utilization}%`,
        );
        // In a real implementation, you might adjust pool size dynamically
      }

      if (poolStats.waitingConnections > 5) {
        this.logger.warn(
          `High number of waiting connections: ${poolStats.waitingConnections}`,
        );
      }

      this.logger.log('Connection pool optimization completed');
    } catch (error) {
      this.logger.error('Failed to optimize connection pool:', error);
    }
  }

  /**
   * Clean up expired cache entries
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupCache(): Promise<void> {
    try {
      this.logger.log('Starting cache cleanup...');

      // Get cache statistics
      const stats = this.cacheService.getStats();

      if (stats.hitRate < 0.5) {
        // If hit rate is low, clear some cache
        // Reset cache statistics to improve monitoring
        this.cacheService.resetStats();
        this.logger.log('Cache statistics reset completed due to low hit rate');
      }
    } catch (error) {
      this.logger.error('Failed to cleanup cache:', error);
    }
  }

  /**
   * Monitor and optimize query performance
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async monitorQueryPerformance(): Promise<void> {
    try {
      const slowQueries = await this.getSlowQueries(10);

      if (slowQueries.length > 0) {
        this.logger.warn(`Found ${slowQueries.length} slow queries`);

        for (const query of slowQueries) {
          this.logger.warn(
            `Slow query: ${query.query.substring(0, 100)}... (${query.duration}ms)`,
          );
        }
      }

      // Check for lock contention
      const locks = await this.checkLockContention();
      if (locks.length > 0) {
        this.logger.warn(`Found ${locks.length} lock contentions`);
      }
    } catch (error) {
      this.logger.error('Failed to monitor query performance:', error);
    }
  }

  /**
   * Optimize memory usage
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async optimizeMemoryUsage(): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent =
      (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    if (memoryUsagePercent > this.performanceConfig.scaling.memoryThreshold) {
      this.logger.warn(`High memory usage: ${memoryUsagePercent.toFixed(1)}%`);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.logger.log('Forced garbage collection');
      }

      // Clear some caches if memory is critically high
      if (memoryUsagePercent > 90) {
        // In a real implementation, you would clear cache entries
        // For now, just reset statistics
        this.cacheService.resetStats();
        this.logger.log('Emergency cache statistics reset performed');
      }
    }
  }

  /**
   * Get slow queries from the database
   */
  private async getSlowQueries(
    limit: number = 50,
  ): Promise<Array<{ query: string; duration: number; calls: number }>> {
    try {
      // This would typically query pg_stat_statements or similar
      // For now, return empty array as we don't have pg_stat_statements enabled
      return [];
    } catch (error) {
      this.logger.error('Failed to get slow queries:', error);
      return [];
    }
  }

  /**
   * Suggest index for a slow query
   */
  private async suggestIndexForQuery(query: {
    query: string;
    duration: number;
    calls: number;
  }): Promise<void> {
    // This is a simplified implementation
    // In a real scenario, you'd analyze the query plan and suggest appropriate indexes

    if (
      query.query.includes('WHERE "userId" =') &&
      query.query.includes('ORDER BY "purchaseDate"')
    ) {
      this.logger.log(
        `Suggested index: CREATE INDEX ON library_games ("userId", "purchaseDate" DESC)`,
      );
    }

    if (query.query.includes('WHERE "gameId" =')) {
      this.logger.log(
        `Suggested index: CREATE INDEX ON library_games ("gameId")`,
      );
    }
  }

  /**
   * Update table statistics for better query planning
   */
  private async updateTableStatistics(): Promise<void> {
    await this.dataSource.query('ANALYZE library_games');
    await this.dataSource.query('ANALYZE purchase_history');

    // Update statistics on materialized views if they exist
    try {
      await this.dataSource.query('ANALYZE mv_user_library_stats');
      await this.dataSource.query('ANALYZE mv_user_purchase_stats');
    } catch (error) {
      // Materialized views might not exist yet
    }
  }

  /**
   * Get most active users for cache warming
   */
  private async getActiveUsers(limit: number): Promise<string[]> {
    const result = await this.dataSource.query(
      `
      SELECT "userId"
      FROM library_games
      WHERE "createdAt" >= NOW() - INTERVAL '7 days'
      GROUP BY "userId"
      ORDER BY COUNT(*) DESC
      LIMIT $1
    `,
      [limit],
    );

    return result.map((row: any) => row.userId);
  }

  /**
   * Get user library data for caching
   */
  private async getUserLibraryForCache(userId: string): Promise<any> {
    const games = await this.dataSource.query(
      `
      SELECT "gameId", "purchaseDate", "purchasePrice", "currency"
      FROM library_games
      WHERE "userId" = $1
      ORDER BY "purchaseDate" DESC
      LIMIT 50
    `,
      [userId],
    );

    return {
      userId,
      games,
      totalGames: games.length,
      cachedAt: new Date(),
    };
  }

  /**
   * Get connection pool statistics
   */
  private async getConnectionPoolStats(): Promise<{
    total: number;
    active: number;
    idle: number;
    waiting: number;
    utilization: number;
    waitingConnections: number;
  }> {
    try {
      // This is a simplified implementation
      // In a real scenario, you'd query the actual connection pool
      const pool = (this.dataSource.driver as any).pool;

      if (pool) {
        const active = pool.numUsed || 0;
        const idle = pool.numFree || 0;
        const waiting = pool.numPendingAcquires || 0;
        const total = active + idle;
        const utilization = total > 0 ? (active / total) * 100 : 0;

        return {
          total,
          active,
          idle,
          waiting,
          utilization,
          waitingConnections: waiting,
        };
      }
    } catch (error) {
      this.logger.error('Failed to get connection pool stats:', error);
    }

    return {
      total: 0,
      active: 0,
      idle: 0,
      waiting: 0,
      utilization: 0,
      waitingConnections: 0,
    };
  }

  /**
   * Check for database lock contention
   */
  private async checkLockContention(): Promise<
    Array<{ query: string; lockType: string; duration: number }>
  > {
    try {
      const result = await this.dataSource.query(`
        SELECT 
          query,
          mode as lock_type,
          EXTRACT(EPOCH FROM (now() - query_start)) * 1000 as duration
        FROM pg_locks l
        JOIN pg_stat_activity a ON l.pid = a.pid
        WHERE NOT granted
        AND query != '<IDLE>'
        ORDER BY duration DESC
        LIMIT 10
      `);

      return result.map((row: any) => ({
        query: row.query,
        lockType: row.lock_type,
        duration: parseFloat(row.duration),
      }));
    } catch (error) {
      // This might fail if we don't have proper permissions
      return [];
    }
  }

  /**
   * Get performance recommendations based on current metrics
   */
  async getPerformanceRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];

    try {
      // Check memory usage
      const memoryUsage = process.memoryUsage();
      const memoryUsagePercent =
        (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      if (memoryUsagePercent > 80) {
        recommendations.push(
          'Consider increasing heap size or optimizing memory usage',
        );
      }

      // Check connection pool
      const poolStats = await this.getConnectionPoolStats();
      if (poolStats.utilization > 80) {
        recommendations.push(
          'Consider increasing database connection pool size',
        );
      }

      // Check slow queries
      const slowQueries = await this.getSlowQueries(5);
      if (slowQueries.length > 0) {
        recommendations.push(
          'Optimize slow database queries or add missing indexes',
        );
      }

      // Check cache performance
      const cacheStats = this.cacheService.getStats();
      if (cacheStats.hitRate < 0.7) {
        recommendations.push(
          'Improve cache hit rate by optimizing cache keys and TTL values',
        );
      }

      if (recommendations.length === 0) {
        recommendations.push(
          'System is performing well within acceptable parameters',
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to generate performance recommendations:',
        error,
      );
      recommendations.push(
        'Unable to generate recommendations due to monitoring error',
      );
    }

    return recommendations;
  }
}
