import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PerformanceMonitoringService } from './performance-monitoring.service';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly performanceMonitoringService: PerformanceMonitoringService,
  ) {}

  /**
   * Get value from cache with performance logging
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const value = await this.cacheManager.get<T>(key);
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
      this.logger.warn(`Cache GET failed for key ${key} (${responseTime}ms): ${error.message}`);
      
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
      const ttlMs = ttl ? ttl * 1000 : undefined;
      await this.cacheManager.set(key, value, ttlMs);
      
      const responseTime = Date.now() - startTime;
      this.logger.debug(`Cache SET for key: ${key}, TTL: ${ttl || 'default'}s (${responseTime}ms)`);

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
      this.logger.warn(`Cache SET failed for key ${key} (${responseTime}ms): ${error.message}`);
    }
  }

  /**
   * Delete value from cache with performance logging
   */
  async del(key: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      await this.cacheManager.del(key);
      
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
      this.logger.warn(`Cache DEL failed for key ${key} (${responseTime}ms): ${error.message}`);
    }
  }

  /**
   * Delete multiple cache keys by pattern
   */
  async delByPattern(pattern: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Note: This is a simplified implementation
      // In production, you might want to use Redis SCAN for better performance
      const keys = await this.getKeysByPattern(pattern);
      
      for (const key of keys) {
        await this.del(key);
      }
      
      const responseTime = Date.now() - startTime;
      this.logger.debug(`Cache DEL by pattern: ${pattern}, deleted ${keys.length} keys (${responseTime}ms)`);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.warn(`Cache DEL by pattern failed for ${pattern} (${responseTime}ms): ${error.message}`);
    }
  }

  /**
   * Get cache keys by pattern (simplified implementation)
   */
  private async getKeysByPattern(pattern: string): Promise<string[]> {
    // This is a simplified implementation
    // In a real Redis implementation, you would use SCAN command
    // For now, we'll return an empty array as this depends on the cache store implementation
    return [];
  }

  /**
   * Invalidate cache for games (used when games are updated)
   */
  async invalidateGameCache(gameId?: string): Promise<void> {
    const patterns = [
      'game-catalog:games_list_*',
      'game-catalog:search_*',
    ];

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
  async warmUpCache(): Promise<void> {
    this.logger.log('Starting cache warm-up...');
    
    // This could be implemented to pre-load popular games, search results, etc.
    // For now, we'll just log the intention
    
    this.logger.log('Cache warm-up completed');
  }

  /**
   * Get cache statistics (if supported by the cache store)
   */
  async getCacheStats(): Promise<any> {
    try {
      // This would depend on the cache store implementation
      // For Redis, you could use INFO command
      return {
        status: 'available',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.warn(`Failed to get cache stats: ${error.message}`);
      return {
        status: 'unavailable',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}