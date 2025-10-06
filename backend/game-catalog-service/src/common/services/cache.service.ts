import { Injectable, Logger } from '@nestjs/common';
import { RedisConfigService } from '../../database/redis-config.service';
import { PerformanceMonitoringService } from './performance-monitoring.service';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    private readonly redisService: RedisConfigService,
    private readonly performanceMonitoringService: PerformanceMonitoringService,
  ) {}

  /**
   * Get value from cache with performance logging
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      const value = await this.redisService.get<T>(key);
      const responseTime = Date.now() - startTime;
      const hit = !!value;

      if (hit) {
        this.logger.debug(`Cache HIT for key: ${key} (${responseTime}ms)`);
      } else {
        this.logger.debug(`Cache MISS for key: ${key} (${responseTime}ms)`);
      }

      // Record cache metrics
      this.performanceMonitoringService.recordCacheMetrics({
        key,
        operation: 'get',
        hit,
        responseTime,
        timestamp: new Date(),
      });

      return value || null;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.warn(
        `Cache GET failed for key ${key} (${responseTime}ms): ${(error as Error).message}`,
      );

      // Record failed cache operation
      this.performanceMonitoringService.recordCacheMetrics({
        key,
        operation: 'get',
        hit: false,
        responseTime,
        timestamp: new Date(),
      });

      return null;
    }
  }

  /**
   * Set value in cache with performance logging
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = Date.now();

    try {
      await this.redisService.set(key, value, ttl);

      const responseTime = Date.now() - startTime;
      this.logger.debug(
        `Cache SET for key: ${key}, TTL: ${ttl || 'default'}s (${responseTime}ms)`,
      );

      // Record cache metrics
      this.performanceMonitoringService.recordCacheMetrics({
        key,
        operation: 'set',
        hit: false, // SET operations don't have hits/misses
        responseTime,
        timestamp: new Date(),
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.warn(
        `Cache SET failed for key ${key} (${responseTime}ms): ${(error as Error).message}`,
      );
    }
  }

  /**
   * Delete value from cache with performance logging
   */
  async del(key: string): Promise<void> {
    const startTime = Date.now();

    try {
      await this.redisService.del(key);

      const responseTime = Date.now() - startTime;
      this.logger.debug(`Cache DEL for key: ${key} (${responseTime}ms)`);

      // Record cache metrics
      this.performanceMonitoringService.recordCacheMetrics({
        key,
        operation: 'del',
        hit: false, // DEL operations don't have hits/misses
        responseTime,
        timestamp: new Date(),
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.warn(
        `Cache DEL failed for key ${key} (${responseTime}ms): ${(error as Error).message}`,
      );
    }
  }

  /**
   * Delete multiple cache keys by pattern
   */
  async delByPattern(pattern: string): Promise<void> {
    const startTime = Date.now();

    try {
      const deletedCount = await this.redisService.clearPattern(pattern);

      const responseTime = Date.now() - startTime;
      this.logger.debug(
        `Cache DEL by pattern: ${pattern}, deleted ${deletedCount} keys (${responseTime}ms)`,
      );
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.warn(
        `Cache DEL by pattern failed for ${pattern} (${responseTime}ms): ${(error as Error).message}`,
      );
    }
  }

  /**
   * Invalidate cache for games (used when games are updated)
   */
  async invalidateGameCache(gameId?: string): Promise<void> {
    const patterns = ['game-catalog:games_list_*', 'game-catalog:search_*'];

    if (gameId) {
      patterns.push(`game-catalog:game_${gameId}`);
      patterns.push(`game-catalog:game_purchase_${gameId}`);
    }

    for (const pattern of patterns) {
      await this.delByPattern(pattern);
    }

    this.logger.log(`Cache invalidated for game${gameId ? ` ${gameId}` : 's'}`);
  }

  /**
   * Warm up cache with frequently accessed data
   */
  warmUpCache(): Promise<void> {
    this.logger.log('Starting cache warm-up...');

    // This could be implemented to pre-load popular games, search results, etc.
    // For now, we'll just log the intention

    this.logger.log('Cache warm-up completed');
    return Promise.resolve();
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    try {
      const stats = await this.redisService.getStats();
      return {
        status: stats.connected ? 'available' : 'unavailable',
        memory: stats.memory,
        keys: stats.keys,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.warn(
        `Failed to get cache stats: ${(error as Error).message}`,
      );
      return {
        status: 'unavailable',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
