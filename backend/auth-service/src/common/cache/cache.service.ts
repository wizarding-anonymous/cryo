import { Injectable, Logger, Optional } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { RedisService } from '../redis/redis.service';

export interface CacheStats {
  localSize: number;
  maxSize: number;
  localHits: number;
  localMisses: number;
  redisHits: number;
  redisMisses: number;
  totalHits: number;
  totalMisses: number;
  hitRatio: number;
  localHitRatio: number;
  redisHitRatio: number;
  memoryUsage: number;
  redisEnabled: boolean;
}

export interface CacheOptions {
  maxSize?: number;
  ttl?: number;
  name?: string;
  useRedis?: boolean;
  redisKeyPrefix?: string;
}

/**
 * Hybrid cache service that uses both local LRU cache and distributed Redis cache
 * - Local LRU cache for ultra-fast access (sub-millisecond)
 * - Redis cache for distributed caching across microservices
 * - Automatic fallback and memory leak prevention
 */
@Injectable()
export class CacheService<K extends string, V> {
  private readonly logger = new Logger(CacheService.name);
  private readonly localCache: LRUCache<K, V>;
  private readonly cacheName: string;
  private readonly useRedis: boolean;
  private readonly redisKeyPrefix: string;
  private readonly ttlSeconds: number;
  
  // Metrics
  private localHits = 0;
  private localMisses = 0;
  private redisHits = 0;
  private redisMisses = 0;
  private readonly startTime = Date.now();

  constructor(
    @Optional() private readonly redisService: RedisService,
    options: CacheOptions = {}
  ) {
    const {
      maxSize = 10000,
      ttl = 5 * 60 * 1000, // 5 minutes default TTL
      name = 'DefaultCache',
      useRedis = true,
      redisKeyPrefix = 'cache'
    } = options;

    this.cacheName = name;
    this.useRedis = useRedis && !!this.redisService;
    this.redisKeyPrefix = `${redisKeyPrefix}:${name.toLowerCase()}`;
    this.ttlSeconds = Math.floor(ttl / 1000);
    
    this.localCache = new LRUCache<K, V>({
      max: maxSize,
      ttl,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      // Automatically dispose of items when they're evicted
      dispose: (value, key, reason) => {
        if (reason === 'evict' || reason === 'set') {
          this.logger.debug(`Local cache item evicted: ${String(key)} (reason: ${reason})`);
        }
      }
    });

    // Set up periodic cleanup and monitoring
    this.setupPeriodicCleanup();
    this.setupPeriodicMonitoring();
    
    this.logger.log(`Cache initialized: ${this.cacheName}, Redis: ${this.useRedis ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get value from cache (checks local first, then Redis)
   */
  async get(key: K): Promise<V | undefined> {
    // First check local cache
    const localValue = this.localCache.get(key);
    if (localValue !== undefined) {
      this.localHits++;
      this.logger.debug(`Local cache hit for key: ${String(key)}`);
      return localValue;
    }
    
    this.localMisses++;
    
    // If not in local cache and Redis is enabled, check Redis
    if (this.useRedis) {
      try {
        const redisKey = this.getRedisKey(key);
        const redisValue = await this.redisService.get(redisKey);
        
        if (redisValue !== null) {
          this.redisHits++;
          const parsedValue = this.deserializeValue(redisValue);
          
          // Store in local cache for future access
          this.localCache.set(key, parsedValue);
          this.logger.debug(`Redis cache hit for key: ${String(key)}, stored in local cache`);
          return parsedValue;
        } else {
          this.redisMisses++;
        }
      } catch (error) {
        this.logger.warn(`Redis cache error for key ${String(key)}: ${error.message}`);
        this.redisMisses++;
      }
    }
    
    this.logger.debug(`Cache miss for key: ${String(key)}`);
    return undefined;
  }

  /**
   * Set value in cache (stores in both local and Redis)
   */
  async set(key: K, value: V, ttl?: number): Promise<void> {
    const effectiveTtl = ttl || this.ttlSeconds * 1000;
    
    // Store in local cache
    this.localCache.set(key, value, { ttl: effectiveTtl });
    
    // Store in Redis if enabled
    if (this.useRedis) {
      try {
        const redisKey = this.getRedisKey(key);
        const serializedValue = this.serializeValue(value);
        const redisTtl = Math.floor(effectiveTtl / 1000);
        
        await this.redisService.set(redisKey, serializedValue, redisTtl);
        this.logger.debug(`Cache set for key: ${String(key)} (local + Redis)`);
      } catch (error) {
        this.logger.warn(`Failed to set Redis cache for key ${String(key)}: ${error.message}`);
        // Continue with local cache only
      }
    } else {
      this.logger.debug(`Cache set for key: ${String(key)} (local only)`);
    }
  }

  /**
   * Check if key exists in cache (checks local first, then Redis)
   */
  async has(key: K): Promise<boolean> {
    // Check local cache first
    if (this.localCache.has(key)) {
      return true;
    }
    
    // Check Redis if enabled
    if (this.useRedis) {
      try {
        const redisKey = this.getRedisKey(key);
        const redisValue = await this.redisService.get(redisKey);
        return redisValue !== null;
      } catch (error) {
        this.logger.warn(`Redis has() error for key ${String(key)}: ${error.message}`);
      }
    }
    
    return false;
  }

  /**
   * Delete key from cache (removes from both local and Redis)
   */
  async delete(key: K): Promise<boolean> {
    let deleted = false;
    
    // Delete from local cache
    const localDeleted = this.localCache.delete(key);
    if (localDeleted) {
      deleted = true;
    }
    
    // Delete from Redis if enabled
    if (this.useRedis) {
      try {
        const redisKey = this.getRedisKey(key);
        await this.redisService.delete(redisKey);
        deleted = true;
        this.logger.debug(`Cache delete for key: ${String(key)} (local + Redis)`);
      } catch (error) {
        this.logger.warn(`Failed to delete Redis cache for key ${String(key)}: ${error.message}`);
      }
    } else {
      this.logger.debug(`Cache delete for key: ${String(key)} (local only)`);
    }
    
    return deleted;
  }

  /**
   * Clear all cache entries (clears both local and Redis with pattern)
   */
  async clear(): Promise<void> {
    // Clear local cache
    this.localCache.clear();
    
    // Clear Redis entries with our prefix if enabled
    if (this.useRedis) {
      try {
        const pattern = `${this.redisKeyPrefix}:*`;
        const keys = await this.redisService.keys(pattern);
        
        if (keys.length > 0) {
          for (const key of keys) {
            await this.redisService.delete(key);
          }
          this.logger.log(`Cleared ${keys.length} Redis entries for cache: ${this.cacheName}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to clear Redis cache: ${error.message}`);
      }
    }
    
    // Reset metrics
    this.localHits = 0;
    this.localMisses = 0;
    this.redisHits = 0;
    this.redisMisses = 0;
    
    this.logger.log(`Cache cleared: ${this.cacheName}`);
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    const totalLocalRequests = this.localHits + this.localMisses;
    const totalRedisRequests = this.redisHits + this.redisMisses;
    const totalRequests = totalLocalRequests + totalRedisRequests;
    const totalHits = this.localHits + this.redisHits;
    const totalMisses = this.localMisses + this.redisMisses;
    
    const hitRatio = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
    const localHitRatio = totalLocalRequests > 0 ? (this.localHits / totalLocalRequests) * 100 : 0;
    const redisHitRatio = totalRedisRequests > 0 ? (this.redisHits / totalRedisRequests) * 100 : 0;
    
    return {
      localSize: this.localCache.size,
      maxSize: this.localCache.max,
      localHits: this.localHits,
      localMisses: this.localMisses,
      redisHits: this.redisHits,
      redisMisses: this.redisMisses,
      totalHits,
      totalMisses,
      hitRatio: Math.round(hitRatio * 100) / 100,
      localHitRatio: Math.round(localHitRatio * 100) / 100,
      redisHitRatio: Math.round(redisHitRatio * 100) / 100,
      memoryUsage: this.calculateMemoryUsage(),
      redisEnabled: this.useRedis
    };
  }

  /**
   * Get local cache entries for debugging
   */
  getLocalEntries(): Array<[K, V]> {
    return Array.from(this.localCache.entries());
  }

  /**
   * Force cleanup of expired entries from local cache
   */
  purgeStale(): void {
    this.localCache.purgeStale();
    this.logger.debug(`Purged stale entries from local cache: ${this.cacheName}`);
  }

  /**
   * Get comprehensive cache info for monitoring
   */
  getCacheInfo() {
    const stats = this.getStats();
    const uptime = Date.now() - this.startTime;
    const memoryPressure = stats.localSize / stats.maxSize;
    
    return {
      name: this.cacheName,
      stats,
      uptime,
      memoryPressure,
      isHealthy: memoryPressure < 0.9, // Consider unhealthy if > 90% full
      redisEnabled: this.useRedis,
      performance: {
        avgLocalHitRatio: stats.localHitRatio,
        avgRedisHitRatio: stats.redisHitRatio,
        totalHitRatio: stats.hitRatio,
        memoryEfficiency: stats.memoryUsage / Math.max(stats.localSize, 1)
      }
    };
  }

  /**
   * Get cache metrics for Prometheus/monitoring
   */
  getMetrics() {
    const stats = this.getStats();
    const info = this.getCacheInfo();
    
    return {
      // Counter metrics
      cache_hits_total: stats.totalHits,
      cache_misses_total: stats.totalMisses,
      cache_local_hits_total: stats.localHits,
      cache_local_misses_total: stats.localMisses,
      cache_redis_hits_total: stats.redisHits,
      cache_redis_misses_total: stats.redisMisses,
      
      // Gauge metrics
      cache_size_current: stats.localSize,
      cache_size_max: stats.maxSize,
      cache_memory_usage_bytes: stats.memoryUsage,
      cache_memory_pressure_ratio: info.memoryPressure,
      cache_hit_ratio_percent: stats.hitRatio,
      cache_local_hit_ratio_percent: stats.localHitRatio,
      cache_redis_hit_ratio_percent: stats.redisHitRatio,
      cache_uptime_seconds: Math.floor(info.uptime / 1000),
      
      // Health metrics
      cache_healthy: info.isHealthy ? 1 : 0,
      cache_redis_enabled: this.useRedis ? 1 : 0,
      
      // Labels
      cache_name: this.cacheName,
      service_name: 'auth-service'
    };
  }

  /**
   * Calculate approximate memory usage of the cache
   */
  private calculateMemoryUsage(): number {
    try {
      let totalSize = 0;
      for (const [key, value] of this.localCache.entries()) {
        totalSize += JSON.stringify(key).length + JSON.stringify(value).length;
      }
      return totalSize;
    } catch {
      // Fallback: estimate based on entry count
      return this.localCache.size * 100; // Rough estimate of 100 bytes per entry
    }
  }

  /**
   * Generate Redis key with proper namespacing
   */
  private getRedisKey(key: K): string {
    return `${this.redisKeyPrefix}:${String(key)}`;
  }

  /**
   * Serialize value for Redis storage
   */
  private serializeValue(value: V): string {
    try {
      return JSON.stringify(value);
    } catch (error) {
      this.logger.error(`Failed to serialize cache value: ${error.message}`);
      throw new Error('Cache serialization failed');
    }
  }

  /**
   * Deserialize value from Redis
   */
  private deserializeValue(serialized: string): V {
    try {
      return JSON.parse(serialized);
    } catch (error) {
      this.logger.error(`Failed to deserialize cache value: ${error.message}`);
      throw new Error('Cache deserialization failed');
    }
  }

  /**
   * Set up periodic cleanup of expired entries
   */
  private setupPeriodicCleanup(): void {
    // Clean up local cache every 5 minutes
    setInterval(() => {
      const sizeBefore = this.localCache.size;
      this.purgeStale();
      const sizeAfter = this.localCache.size;
      
      if (sizeBefore !== sizeAfter) {
        this.logger.log(`Local cache cleanup completed: ${this.cacheName}, removed ${sizeBefore - sizeAfter} expired entries`);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Set up periodic monitoring and alerting
   */
  private setupPeriodicMonitoring(): void {
    // Monitor every 10 minutes
    setInterval(() => {
      const info = this.getCacheInfo();
      const stats = info.stats;
      
      // Log comprehensive cache statistics
      this.logger.log(`Cache stats for ${this.cacheName}:`, {
        localSize: stats.localSize,
        maxSize: stats.maxSize,
        totalHitRatio: `${stats.hitRatio}%`,
        localHitRatio: `${stats.localHitRatio}%`,
        redisHitRatio: `${stats.redisHitRatio}%`,
        memoryUsage: `${Math.round(stats.memoryUsage / 1024)}KB`,
        memoryPressure: `${Math.round(info.memoryPressure * 100)}%`,
        redisEnabled: this.useRedis
      });

      // Alert if local cache is getting full
      if (info.memoryPressure > 0.8) {
        this.logger.warn(`Cache ${this.cacheName} local storage is ${Math.round(info.memoryPressure * 100)}% full. Consider increasing max size or reducing TTL.`);
      }

      // Alert if overall hit ratio is low
      if (stats.hitRatio < 50 && (stats.totalHits + stats.totalMisses) > 100) {
        this.logger.warn(`Cache ${this.cacheName} has low overall hit ratio: ${stats.hitRatio}%. Local: ${stats.localHitRatio}%, Redis: ${stats.redisHitRatio}%`);
      }

      // Alert if local hit ratio is too low (might indicate Redis is doing most of the work)
      if (stats.localHitRatio < 30 && stats.localHits + stats.localMisses > 50) {
        this.logger.warn(`Cache ${this.cacheName} has low local hit ratio: ${stats.localHitRatio}%. Consider increasing local cache size or TTL.`);
      }

      // Alert if Redis is enabled but not being used effectively
      if (this.useRedis && stats.redisHitRatio < 20 && stats.redisHits + stats.redisMisses > 50) {
        this.logger.warn(`Cache ${this.cacheName} has low Redis hit ratio: ${stats.redisHitRatio}%. Consider reviewing Redis TTL or cache strategy.`);
      }

      // Alert if not healthy
      if (!info.isHealthy) {
        this.logger.error(`Cache ${this.cacheName} is unhealthy. Memory pressure: ${Math.round(info.memoryPressure * 100)}%`);
      }

      // Performance insights
      if (stats.totalHits + stats.totalMisses > 1000) {
        const localEfficiency = stats.localHits / (stats.localHits + stats.redisHits) * 100;
        if (localEfficiency < 70) {
          this.logger.log(`Cache ${this.cacheName} performance insight: ${Math.round(localEfficiency)}% of hits are from local cache. Consider optimizing local cache strategy.`);
        }
      }
    }, 10 * 60 * 1000);
  }
}