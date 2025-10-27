import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from '../metrics/metrics.service';

/**
 * Optimized multi-level cache service for high performance
 * Implements L1 (in-memory) and L2 (Redis) caching with intelligent TTL management
 */
@Injectable()
export class OptimizedCacheService {
  private readonly logger = new Logger(OptimizedCacheService.name);
  
  // L1 Cache (In-Memory) - for frequently accessed data
  private readonly memoryCache = new Map<
    string,
    { data: any; expires: number }
  >();
  private readonly maxMemoryCacheSize = 1000; // Maximum items in memory cache
  private readonly memoryCacheCleanupInterval = 60000; // 1 minute cleanup interval
  
  // Cache TTL strategies by data type
  private readonly CACHE_TTL = {
    USER_PROFILE: 600,      // 10 minutes - rarely changes
    USER_PREFERENCES: 1800, // 30 minutes - very rarely changes  
    USER_BASIC: 300,        // 5 minutes - may change more often
    USER_STATS: 60,         // 1 minute - for statistics
    BATCH_RESULTS: 30,      // 30 seconds - for batch operations
    USER_SESSION: 900,      // 15 minutes - session data
    USER_PERMISSIONS: 1200, // 20 minutes - permissions cache
  } as const;

  // Memory cache TTL (shorter than Redis)
  private readonly MEMORY_TTL = {
    USER_PROFILE: 60,       // 1 minute in memory
    USER_PREFERENCES: 300,  // 5 minutes in memory
    USER_BASIC: 30,         // 30 seconds in memory
    USER_STATS: 15,         // 15 seconds in memory
    BATCH_RESULTS: 10,      // 10 seconds in memory
    USER_SESSION: 60,       // 1 minute in memory
    USER_PERMISSIONS: 120,  // 2 minutes in memory
  } as const;

  constructor(
    private readonly redisService: RedisService,
    private readonly metricsService: MetricsService,
  ) {
    // Start memory cache cleanup
    this.startMemoryCacheCleanup();
    this.logger.log('OptimizedCacheService initialized with multi-level caching');
  }

  /**
   * Get data with multi-level caching strategy
   */
  async get<T>(
    key: string,
    cacheType: keyof typeof this.CACHE_TTL = 'USER_BASIC',
  ): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      // Try L1 cache first (memory)
      const memoryResult = this.getFromMemory<T>(key);
      if (memoryResult !== null) {
        this.recordCacheHit('memory', Date.now() - startTime);
        return memoryResult;
      }

      // Try L2 cache (Redis)
      const redisResult = await this.getFromRedis<T>(key);
      if (redisResult !== null) {
        // Store in memory cache for faster future access
        this.setInMemory(key, redisResult, cacheType);
        this.recordCacheHit('redis', Date.now() - startTime);
        return redisResult;
      }

      this.recordCacheMiss(Date.now() - startTime);
      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      this.recordCacheError('get');
      return null;
    }
  }

  /**
   * Set data in both cache levels
   */
  async set<T>(
    key: string, 
    value: T, 
    cacheType: keyof typeof this.CACHE_TTL = 'USER_BASIC'
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Set in both caches
      await Promise.all([
        this.setInRedis(key, value, cacheType),
        this.setInMemory(key, value, cacheType),
      ]);
      
      this.recordCacheOperation('set', Date.now() - startTime);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
      this.recordCacheError('set');
      throw error;
    }
  }

  /**
   * Invalidate data from both cache levels
   */
  async invalidate(key: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      await this.deleteFromRedis(key);
      this.deleteFromMemory(key);
      
      this.recordCacheOperation('invalidate', Date.now() - startTime);
    } catch (error) {
      this.logger.error(`Cache invalidate error for key ${key}:`, error);
      this.recordCacheError('invalidate');
    }
  }

  /**
   * Batch get operations for multiple keys
   */
  async getBatch<T>(
    keys: string[], 
    cacheType: keyof typeof this.CACHE_TTL = 'USER_BASIC'
  ): Promise<Map<string, T>> {
    const startTime = Date.now();
    const results = new Map<string, T>();
    const missingKeys: string[] = [];

    try {
      // Check memory cache first
      for (const key of keys) {
        const memoryResult = this.getFromMemory<T>(key);
        if (memoryResult !== null) {
          results.set(key, memoryResult);
        } else {
          missingKeys.push(key);
        }
      }

      // Get missing keys from Redis
      if (missingKeys.length > 0) {
        const redisResults = await this.getBatchFromRedis<T>(missingKeys);
        
        for (const [key, value] of redisResults) {
          results.set(key, value);
          // Cache in memory for future access
          this.setInMemory(key, value, cacheType);
        }
      }

      this.recordBatchOperation(keys.length, results.size, Date.now() - startTime);
      return results;
    } catch (error) {
      this.logger.error(`Batch cache get error:`, error);
      this.recordCacheError('batch_get');
      return results;
    }
  }

  /**
   * Batch set operations for multiple key-value pairs
   */
  async setBatch<T>(
    items: Map<string, T>, 
    cacheType: keyof typeof this.CACHE_TTL = 'USER_BASIC'
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      const redisPromises: Promise<void>[] = [];
      
      for (const [key, value] of items) {
        redisPromises.push(this.setInRedis(key, value, cacheType));
        this.setInMemory(key, value, cacheType);
      }
      
      await Promise.all(redisPromises);
      this.recordBatchOperation(items.size, items.size, Date.now() - startTime);
    } catch (error) {
      this.logger.error(`Batch cache set error:`, error);
      this.recordCacheError('batch_set');
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      memoryCache: {
        size: this.memoryCache.size,
        maxSize: this.maxMemoryCacheSize,
        utilization: (this.memoryCache.size / this.maxMemoryCacheSize) * 100,
      },
      ttlStrategies: this.CACHE_TTL,
      memoryTtl: this.MEMORY_TTL,
    };
  }

  /**
   * Clear all caches (use with caution)
   */
  async clearAll(): Promise<void> {
    try {
      this.memoryCache.clear();
      // Note: We don't clear Redis as it might be shared with other services
      this.logger.warn('Memory cache cleared');
    } catch (error) {
      this.logger.error('Error clearing caches:', error);
    }
  }

  // Private methods for L1 cache (memory)
  private getFromMemory<T>(key: string): T | null {
    const cached = this.memoryCache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.expires) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  private setInMemory<T>(
    key: string, 
    value: T, 
    cacheType: keyof typeof this.MEMORY_TTL
  ): void {
    // Implement LRU eviction if cache is full
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      this.evictLRU();
    }
    
    const ttl = this.MEMORY_TTL[cacheType] * 1000; // Convert to milliseconds
    this.memoryCache.set(key, {
      data: value,
      expires: Date.now() + ttl,
    });
  }

  private deleteFromMemory(key: string): void {
    this.memoryCache.delete(key);
  }

  // Private methods for L2 cache (Redis)
  private async getFromRedis<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redisService.get<T>(key);
      return value;
    } catch (error) {
      this.logger.error(`Redis get error for key ${key}:`, error);
      return null;
    }
  }

  private async setInRedis<T>(
    key: string, 
    value: T, 
    cacheType: keyof typeof this.CACHE_TTL
  ): Promise<void> {
    try {
      const ttl = this.CACHE_TTL[cacheType];
      await this.redisService.set(key, value, ttl);
    } catch (error) {
      this.logger.error(`Redis set error for key ${key}:`, error);
      throw error;
    }
  }

  private async deleteFromRedis(key: string): Promise<void> {
    try {
      await this.redisService.del(key);
    } catch (error) {
      this.logger.error(`Redis delete error for key ${key}:`, error);
    }
  }

  private async getBatchFromRedis<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    
    try {
      // Use Redis client directly for batch operations
      const client = this.redisService.getClient();
      const values = await client.mget(...keys);
      
      for (let i = 0; i < keys.length; i++) {
        if (values[i]) {
          try {
            results.set(keys[i], JSON.parse(values[i]) as T);
          } catch (parseError) {
            this.logger.error(`JSON parse error for key ${keys[i]}:`, parseError);
          }
        }
      }
    } catch (error) {
      this.logger.error('Redis batch get error:', error);
    }
    
    return results;
  }

  // Cache maintenance
  private evictLRU(): void {
    // Simple LRU: remove oldest entries (first in Map)
    const keysToRemove = Array.from(this.memoryCache.keys()).slice(0, 100);
    keysToRemove.forEach((key) => this.memoryCache.delete(key));
  }

  private startMemoryCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];
      
      for (const [key, cached] of this.memoryCache) {
        if (now > cached.expires) {
          expiredKeys.push(key);
        }
      }
      
      expiredKeys.forEach((key) => this.memoryCache.delete(key));
      
      if (expiredKeys.length > 0) {
        this.logger.debug(`Cleaned up ${expiredKeys.length} expired cache entries`);
      }
    }, this.memoryCacheCleanupInterval);
  }

  // Metrics recording
  private recordCacheHit(level: 'memory' | 'redis', duration: number): void {
    this.metricsService.recordCacheOperation('hit', level, duration);
  }

  private recordCacheMiss(duration: number): void {
    this.metricsService.recordCacheOperation('miss', 'redis', duration);
  }

  private recordCacheOperation(operation: string, duration: number): void {
    // Log cache operation for monitoring
    this.logger.debug(`Cache ${operation} completed in ${duration}ms`);
  }

  private recordBatchOperation(requested: number, found: number, duration: number): void {
    this.metricsService.recordBatchOperation('cache_batch', 'success', requested, duration);
    
    // Log batch cache efficiency
    const hitRatio = found / requested;
    this.logger.debug(`Cache batch operation: ${found}/${requested} found (${Math.round(hitRatio * 100)}% hit rate)`);
  }

  private recordCacheError(operation: string): void {
    this.logger.error(`Cache error in operation: ${operation}`);
    this.metricsService.recordCacheOperation('miss', 'redis'); // Record as cache miss for errors
  }
}