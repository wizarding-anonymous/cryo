import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { EnvironmentVariables } from '../../config/env.validation';

export interface QueryCacheOptions {
  ttl?: number;
  key?: string;
  tags?: string[];
  skipCache?: boolean;
  keyGenerator?: (...args: any[]) => string;
}

export interface QueryCacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalQueries: number;
  cacheSize: number;
  memoryUsage: number;
}

export interface CachedQuery {
  query: string;
  parameters: any[];
  result: any;
  timestamp: number;
  ttl: number;
  tags: string[];
}

/**
 * TypeORM Query Cache Service
 * Provides intelligent caching for TypeORM queries using Redis
 * with advanced features like cache tagging, invalidation, and monitoring
 */
@Injectable()
export class TypeOrmQueryCacheService implements OnModuleInit {
  private readonly logger = new Logger(TypeOrmQueryCacheService.name);
  private readonly keyPrefix = 'user-service:typeorm-cache:';
  private readonly statsKey = 'user-service:typeorm-cache:stats';
  private readonly tagsKey = 'user-service:typeorm-cache:tags:';

  private stats: QueryCacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalQueries: 0,
    cacheSize: 0,
    memoryUsage: 0,
  };

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  async onModuleInit() {
    await this.loadStats();
    this.logger.log('TypeORM Query Cache Service initialized');
  }

  /**
   * Get Redis client instance
   */
  private get redis() {
    return this.redisService.getClient();
  }

  /**
   * Get cached query result
   */
  async get(
    query: string,
    parameters: any[] = [],
    keyGenerator?: (...args: any[]) => string,
  ): Promise<any | null> {
    try {
      const cacheKey = keyGenerator
        ? `${this.keyPrefix}${keyGenerator(...parameters)}`
        : this.generateCacheKey(query, parameters);

      const cachedData = await this.redis.get(cacheKey);

      if (cachedData) {
        const parsed: CachedQuery = JSON.parse(cachedData);

        // Check if cache entry is still valid
        if (Date.now() - parsed.timestamp < parsed.ttl * 1000) {
          await this.incrementHits();
          this.logger.debug(
            `Cache hit for query: ${this.truncateQuery(query)}`,
          );
          return parsed.result;
        } else {
          // Remove expired entry
          await this.redis.del(cacheKey);
        }
      }

      await this.incrementMisses();
      this.logger.debug(`Cache miss for query: ${this.truncateQuery(query)}`);
      return null;
    } catch (error) {
      this.logger.error('Error getting cached query:', error);
      return null;
    }
  }

  /**
   * Cache query result with options
   */
  async set(
    query: string,
    parameters: any[] = [],
    result: any,
    options: QueryCacheOptions = {},
  ): Promise<void> {
    try {
      const {
        ttl = this.getDefaultTTL(),
        tags = [],
        skipCache = false,
        keyGenerator,
      } = options;

      if (skipCache || !this.shouldCacheQuery(query)) {
        return;
      }

      const cacheKey = keyGenerator
        ? `${this.keyPrefix}${keyGenerator(...parameters)}`
        : this.generateCacheKey(query, parameters);

      const cachedQuery: CachedQuery = {
        query,
        parameters,
        result,
        timestamp: Date.now(),
        ttl,
        tags,
      };

      // Set the cache entry with TTL
      await this.redis.setex(cacheKey, ttl, JSON.stringify(cachedQuery));

      // Update tags mapping for invalidation
      if (tags.length > 0) {
        await this.updateTagsMapping(cacheKey, tags);
      }

      await this.updateCacheSize();
      this.logger.debug(`Cached query result: ${this.truncateQuery(query)}`);
    } catch (error) {
      this.logger.error('Error caching query result:', error);
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      let invalidatedCount = 0;

      for (const tag of tags) {
        const tagKey = `${this.tagsKey}${tag}`;
        const cacheKeys = await this.redis.smembers(tagKey);

        if (cacheKeys.length > 0) {
          // Delete cache entries
          await this.redis.del(...cacheKeys);

          // Remove tag mapping
          await this.redis.del(tagKey);

          invalidatedCount += cacheKeys.length;
        }
      }

      if (invalidatedCount > 0) {
        await this.updateCacheSize();
        this.logger.log(
          `Invalidated ${invalidatedCount} cache entries by tags: ${tags.join(', ')}`,
        );
      }

      return invalidatedCount;
    } catch (error) {
      this.logger.error('Error invalidating cache by tags:', error);
      return 0;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}${pattern}`);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        await this.updateCacheSize();
        this.logger.log(
          `Invalidated ${keys.length} cache entries by pattern: ${pattern}`,
        );
      }

      return keys.length;
    } catch (error) {
      this.logger.error('Error invalidating cache by pattern:', error);
      return 0;
    }
  }

  /**
   * Clear all query cache
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      const tagKeys = await this.redis.keys(`${this.tagsKey}*`);

      const allKeys = [...keys, ...tagKeys];

      if (allKeys.length > 0) {
        await this.redis.del(...allKeys);
        this.logger.log(`Cleared ${allKeys.length} cache entries`);
      }

      // Reset stats
      this.stats.cacheSize = 0;
      this.stats.memoryUsage = 0;
      await this.saveStats();
    } catch (error) {
      this.logger.error('Error clearing query cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<QueryCacheStats> {
    await this.updateCacheSize();
    await this.updateMemoryUsage();

    // Calculate hit rate
    if (this.stats.totalQueries > 0) {
      this.stats.hitRate = (this.stats.hits / this.stats.totalQueries) * 100;
    }

    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  async resetStats(): Promise<void> {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalQueries: 0,
      cacheSize: this.stats.cacheSize,
      memoryUsage: this.stats.memoryUsage,
    };

    await this.saveStats();
    this.logger.log('Cache statistics reset');
  }

  /**
   * Get cache entries by tag
   */
  async getEntriesByTag(tag: string): Promise<string[]> {
    try {
      const tagKey = `${this.tagsKey}${tag}`;
      return await this.redis.smembers(tagKey);
    } catch (error) {
      this.logger.error('Error getting entries by tag:', error);
      return [];
    }
  }

  /**
   * Warm up cache with predefined queries
   */
  async warmUp(
    queries: Array<{
      query: string;
      parameters?: any[];
      options?: QueryCacheOptions;
    }>,
  ): Promise<void> {
    this.logger.log(`Warming up cache with ${queries.length} queries`);

    for (const { query, parameters = [], options = {} } of queries) {
      try {
        // Check if already cached
        const cached = await this.get(query, parameters);
        if (!cached) {
          // This would typically be called after executing the actual query
          // For warmup, we skip actual execution and just log
          this.logger.debug(
            `Cache warmup placeholder for: ${this.truncateQuery(query)}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error warming up query: ${this.truncateQuery(query)}`,
          error,
        );
      }
    }
  }

  /**
   * Generate cache key from query and parameters
   */
  private generateCacheKey(query: string, parameters: any[]): string {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    const paramString = JSON.stringify(parameters);
    const hash = this.hashString(`${normalizedQuery}:${paramString}`);
    return `${this.keyPrefix}${hash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if query should be cached
   */
  private shouldCacheQuery(query: string): boolean {
    const normalizedQuery = query.toLowerCase().trim();

    // Don't cache write operations
    if (
      normalizedQuery.startsWith('insert') ||
      normalizedQuery.startsWith('update') ||
      normalizedQuery.startsWith('delete')
    ) {
      return false;
    }

    // Don't cache queries with random functions
    if (
      normalizedQuery.includes('random()') ||
      normalizedQuery.includes('now()') ||
      normalizedQuery.includes('current_timestamp')
    ) {
      return false;
    }

    // Don't cache very large queries (potential memory issue)
    if (query.length > 10000) {
      return false;
    }

    return true;
  }

  /**
   * Get default TTL based on environment
   */
  private getDefaultTTL(): number {
    const nodeEnv = this.configService.get('NODE_ENV');

    switch (nodeEnv) {
      case 'production':
        return 300; // 5 minutes
      case 'development':
        return 60; // 1 minute
      case 'test':
        return 30; // 30 seconds
      default:
        return 60;
    }
  }

  /**
   * Update tags mapping for cache invalidation
   */
  private async updateTagsMapping(
    cacheKey: string,
    tags: string[],
  ): Promise<void> {
    for (const tag of tags) {
      const tagKey = `${this.tagsKey}${tag}`;
      await this.redis.sadd(tagKey, cacheKey);
      // Set TTL for tag mapping (longer than cache entries)
      await this.redis.expire(tagKey, this.getDefaultTTL() * 2);
    }
  }

  /**
   * Increment cache hits
   */
  private async incrementHits(): Promise<void> {
    this.stats.hits++;
    this.stats.totalQueries++;

    // Periodically save stats to Redis
    if (this.stats.totalQueries % 100 === 0) {
      await this.saveStats();
    }
  }

  /**
   * Increment cache misses
   */
  private async incrementMisses(): Promise<void> {
    this.stats.misses++;
    this.stats.totalQueries++;

    // Periodically save stats to Redis
    if (this.stats.totalQueries % 100 === 0) {
      await this.saveStats();
    }
  }

  /**
   * Update cache size
   */
  private async updateCacheSize(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      this.stats.cacheSize = keys.length;
    } catch (error) {
      this.logger.error('Error updating cache size:', error);
    }
  }

  /**
   * Update memory usage estimation
   */
  private async updateMemoryUsage(): Promise<void> {
    try {
      // Get memory usage for our keys (approximation)
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      let totalMemory = 0;

      // Sample a few keys to estimate average size
      const sampleSize = Math.min(keys.length, 10);
      if (sampleSize > 0) {
        const sampleKeys = keys.slice(0, sampleSize);
        let sampleMemory = 0;

        for (const key of sampleKeys) {
          const value = await this.redis.get(key);
          if (value) {
            sampleMemory +=
              Buffer.byteLength(key, 'utf8') + Buffer.byteLength(value, 'utf8');
          }
        }

        // Estimate total memory usage
        const avgSize = sampleMemory / sampleSize;
        totalMemory = avgSize * keys.length;
      }

      this.stats.memoryUsage = totalMemory;
    } catch (error) {
      this.logger.error('Error updating memory usage:', error);
    }
  }

  /**
   * Save statistics to Redis
   */
  private async saveStats(): Promise<void> {
    try {
      await this.redis.setex(
        this.statsKey,
        3600, // 1 hour TTL
        JSON.stringify(this.stats),
      );
    } catch (error) {
      this.logger.error('Error saving cache stats:', error);
    }
  }

  /**
   * Load statistics from Redis
   */
  private async loadStats(): Promise<void> {
    try {
      const statsData = await this.redis.get(this.statsKey);
      if (statsData) {
        this.stats = { ...this.stats, ...JSON.parse(statsData) };
      }
    } catch (error) {
      this.logger.error('Error loading cache stats:', error);
    }
  }

  /**
   * Truncate query for logging
   */
  private truncateQuery(query: string): string {
    return query.length > 100 ? `${query.substring(0, 100)}...` : query;
  }
}
