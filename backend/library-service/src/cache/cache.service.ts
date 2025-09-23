import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalOperations: number;
}

export interface CacheKeyPattern {
  pattern: string;
  ttl: number;
  description: string;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private stats = { hits: 0, misses: 0 };

  // Predefined cache patterns with optimized TTL strategies
  private readonly cachePatterns: Record<string, CacheKeyPattern> = {
    library: {
      pattern: 'library_*',
      ttl: 300, // 5 minutes for user libraries (frequently accessed, moderately dynamic)
      description: 'User library data with pagination and sorting',
    },
    search: {
      pattern: 'search_*',
      ttl: 300, // 5 minutes for search results (same as library for consistency)
      description: 'Search results with query parameters and scoring',
    },
    gameDetails: {
      pattern: 'game_details_*',
      ttl: 1800, // 30 minutes for game details (less frequently changing)
      description: 'Game catalog details from external service',
    },
    userProfile: {
      pattern: 'user_profile_*',
      ttl: 600, // 10 minutes for user profiles
      description: 'User profile information from user service',
    },
    ownership: {
      pattern: 'ownership_*',
      ttl: 180, // 3 minutes for ownership checks (more dynamic, affects downloads)
      description: 'Game ownership verification for access control',
    },
    purchaseHistory: {
      pattern: 'history_*',
      ttl: 600, // 10 minutes for purchase history (less frequently changing)
      description: 'User purchase history with filtering and pagination',
    },
    searchField: {
      pattern: 'search_field_*',
      ttl: 450, // 7.5 minutes for field-specific searches (between search and library)
      description: 'Field-specific search results (title, developer, tags)',
    },
    libraryStats: {
      pattern: 'library_stats_*',
      ttl: 900, // 15 minutes for library statistics (less critical, can be stale)
      description: 'User library statistics and aggregations',
    },
  };

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  /**
   * Get value from cache with statistics tracking
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.cacheManager.get<T>(key);
      
      if (value !== undefined && value !== null) {
        this.stats.hits++;
        this.logger.debug(`Cache HIT for key: ${key}`);
      } else {
        this.stats.misses++;
        this.logger.debug(`Cache MISS for key: ${key}`);
      }
      
      return value ?? undefined;
    } catch (error: unknown) {
      this.logger.error(`Cache GET error for key ${key}:`, error instanceof Error ? error.message : String(error));
      this.stats.misses++;
      return undefined;
    }
  }

  /**
   * Set value in cache with automatic TTL selection based on key pattern
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const finalTtl = ttl ?? this.getTtlForKey(key);
      await this.cacheManager.set(key, value, finalTtl);
      this.logger.debug(`Cache SET for key: ${key}, TTL: ${finalTtl}s`);
    } catch (error: unknown) {
      this.logger.error(`Cache SET error for key ${key}:`, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Delete single key from cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache DEL for key: ${key}`);
    } catch (error: unknown) {
      this.logger.error(`Cache DEL error for key ${key}:`, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Get or set pattern with enhanced error handling and statistics
   */
  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cachedData = await this.get<T>(key);
    if (cachedData !== undefined) {
      return cachedData;
    }

    try {
      const newData = await fn();
      await this.set(key, newData, ttl);
      return newData;
    } catch (error: unknown) {
      this.logger.error(`Error in getOrSet for key ${key}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Bulk get operation for multiple keys
   */
  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    
    try {
      const promises = keys.map(async (key) => {
        const value = await this.get<T>(key);
        return { key, value };
      });
      
      const resolved = await Promise.all(promises);
      
      resolved.forEach(({ key, value }) => {
        if (value !== undefined) {
          results.set(key, value);
        }
      });
      
      this.logger.debug(`Bulk GET for ${keys.length} keys, found ${results.size} values`);
    } catch (error: unknown) {
      this.logger.error('Bulk GET error:', error instanceof Error ? error.message : String(error));
    }
    
    return results;
  }

  /**
   * Bulk set operation for multiple key-value pairs
   */
  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    try {
      const promises = entries.map(({ key, value, ttl }) => 
        this.set(key, value, ttl)
      );
      
      await Promise.all(promises);
      this.logger.debug(`Bulk SET for ${entries.length} keys`);
    } catch (error: unknown) {
      this.logger.error('Bulk SET error:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      // Note: This is a simplified implementation
      // In production, you might want to use Redis SCAN for better performance
      const keysToDelete = await this.getKeysMatchingPattern(pattern);
      
      if (keysToDelete.length === 0) {
        return 0;
      }
      
      const promises = keysToDelete.map(key => this.del(key));
      await Promise.all(promises);
      
      this.logger.debug(`Deleted ${keysToDelete.length} keys matching pattern: ${pattern}`);
      return keysToDelete.length;
    } catch (error: unknown) {
      this.logger.error(`Error deleting pattern ${pattern}:`, error instanceof Error ? error.message : String(error));
      return 0;
    }
  }

  /**
   * Invalidate all cache entries for a specific user
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      const userCacheKeysKey = `user-cache-keys:${userId}`;
      const keysToDelete = await this.get<string[]>(userCacheKeysKey);

      if (keysToDelete && keysToDelete.length > 0) {
        const promises = keysToDelete.map(key => this.del(key));
        await Promise.all(promises);
        this.logger.debug(`Invalidated ${keysToDelete.length} cache entries for user ${userId}`);
      }

      // Clean up the tracking key itself
      await this.del(userCacheKeysKey);
    } catch (error: unknown) {
      this.logger.error(`Error invalidating user cache for ${userId}:`, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Invalidate library-specific cache entries for a user
   * More targeted invalidation for library operations
   */
  async invalidateUserLibraryCache(userId: string): Promise<void> {
    try {
      const userCacheKeysKey = `user-cache-keys:${userId}`;
      const allUserKeys = await this.get<string[]>(userCacheKeysKey) ?? [];
      
      // Filter for library and search related keys
      const libraryKeys = allUserKeys.filter(key => 
        key.startsWith('library_') || 
        key.startsWith('search_') || 
        key.startsWith('ownership_')
      );

      if (libraryKeys.length > 0) {
        const promises = libraryKeys.map(key => this.del(key));
        await Promise.all(promises);
        
        // Update the tracking key to remove deleted keys
        const remainingKeys = allUserKeys.filter(key => !libraryKeys.includes(key));
        if (remainingKeys.length > 0) {
          await this.set(userCacheKeysKey, remainingKeys, 0);
        } else {
          await this.del(userCacheKeysKey);
        }
        
        this.logger.debug(`Invalidated ${libraryKeys.length} library cache entries for user ${userId}`);
      }
    } catch (error: unknown) {
      this.logger.error(`Error invalidating user library cache for ${userId}:`, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Cache library data with optimized TTL and user tracking
   */
  async cacheLibraryData<T>(userId: string, cacheKey: string, data: T, customTtl?: number): Promise<void> {
    const ttl = customTtl ?? this.cachePatterns.library.ttl;
    await this.set(cacheKey, data, ttl);
    await this.recordUserCacheKey(userId, cacheKey);
  }

  /**
   * Cache search results with optimized TTL and user tracking
   */
  async cacheSearchResults<T>(userId: string, cacheKey: string, results: T, customTtl?: number): Promise<void> {
    const ttl = customTtl ?? this.cachePatterns.search.ttl;
    await this.set(cacheKey, results, ttl);
    await this.recordUserCacheKey(userId, cacheKey);
  }

  /**
   * Get cached library data with fallback function
   */
  async getCachedLibraryData<T>(
    userId: string,
    cacheKey: string,
    fallbackFn: () => Promise<T>,
    customTtl?: number
  ): Promise<T> {
    const result = await this.getOrSet(cacheKey, fallbackFn, customTtl ?? this.cachePatterns.library.ttl);
    await this.recordUserCacheKey(userId, cacheKey);
    return result;
  }

  /**
   * Get cached search results with fallback function
   */
  async getCachedSearchResults<T>(
    userId: string,
    cacheKey: string,
    fallbackFn: () => Promise<T>,
    customTtl?: number
  ): Promise<T> {
    const result = await this.getOrSet(cacheKey, fallbackFn, customTtl ?? this.cachePatterns.search.ttl);
    await this.recordUserCacheKey(userId, cacheKey);
    return result;
  }

  /**
   * Invalidate game-related cache entries across all users
   * Useful when game details are updated in the catalog
   */
  async invalidateGameCache(gameId: string): Promise<void> {
    try {
      // This would require Redis SCAN in production
      // For now, we log the operation
      this.logger.debug(`Game cache invalidation requested for game ${gameId}`);
      
      // In a real Redis implementation, you would:
      // 1. SCAN for keys matching patterns like "library_*", "search_*"
      // 2. Check if they contain the gameId
      // 3. Delete matching keys
      
      // For now, we'll invalidate the game details cache
      const gameDetailsKey = `game_details_${gameId}`;
      await this.del(gameDetailsKey);
      
    } catch (error: unknown) {
      this.logger.error(`Error invalidating game cache for ${gameId}:`, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Record a cache key for a user (for efficient invalidation)
   */
  async recordUserCacheKey(userId: string, key: string): Promise<void> {
    try {
      const userCacheKeysKey = `user-cache-keys:${userId}`;
      const userKeys = await this.get<string[]>(userCacheKeysKey) ?? [];
      
      if (!userKeys.includes(key)) {
        userKeys.push(key);
        
        // Limit the number of tracked keys to prevent memory issues
        if (userKeys.length > 100) {
          userKeys.shift(); // Remove oldest key
        }
        
        await this.set(userCacheKeysKey, userKeys, 0); // No TTL for tracking keys
      }
    } catch (error: unknown) {
      this.logger.error(`Error recording user cache key for ${userId}:`, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalOperations = this.stats.hits + this.stats.misses;
    const hitRate = totalOperations > 0 ? this.stats.hits / totalOperations : 0;
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      totalOperations,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
    this.logger.debug('Cache statistics reset');
  }

  /**
   * Get cache patterns configuration
   */
  getCachePatterns(): Record<string, CacheKeyPattern> {
    return { ...this.cachePatterns };
  }

  /**
   * Warm up cache with commonly accessed data
   */
  async warmUp(warmUpFunctions: Array<{ key: string; fn: () => Promise<any>; ttl?: number }>): Promise<void> {
    try {
      this.logger.log(`Starting cache warm-up for ${warmUpFunctions.length} entries`);
      
      const promises = warmUpFunctions.map(async ({ key, fn, ttl }) => {
        try {
          const exists = await this.get(key);
          if (exists === undefined) {
            const data = await fn();
            await this.set(key, data, ttl);
            this.logger.debug(`Warmed up cache key: ${key}`);
          }
        } catch (error: unknown) {
          this.logger.warn(`Failed to warm up cache key ${key}:`, error instanceof Error ? error.message : String(error));
        }
      });
      
      await Promise.all(promises);
      this.logger.log('Cache warm-up completed');
    } catch (error: unknown) {
      this.logger.error('Cache warm-up error:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Health check for cache service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const testKey = 'health-check-' + Date.now();
      const testValue = { timestamp: Date.now() };
      
      // Test set operation
      await this.set(testKey, testValue, 10);
      
      // Test get operation
      const retrieved = await this.get(testKey);
      
      // Test delete operation
      await this.del(testKey);
      
      const isHealthy = retrieved !== undefined && 
                       retrieved !== null &&
                       typeof retrieved === 'object' &&
                       'timestamp' in retrieved &&
                       retrieved.timestamp === testValue.timestamp;
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        details: {
          canWrite: true,
          canRead: retrieved !== undefined,
          stats: this.getStats(),
        },
      };
    } catch (error: unknown) {
      this.logger.error('Cache health check failed:', error instanceof Error ? error.message : String(error));
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : String(error),
          stats: this.getStats(),
        },
      };
    }
  }

  /**
   * Get TTL for a key based on predefined patterns
   */
  private getTtlForKey(key: string): number {
    for (const config of Object.values(this.cachePatterns)) {
      const pattern = config.pattern.replace('*', '');
      if (key.startsWith(pattern)) {
        return config.ttl;
      }
    }
    
    // Default TTL if no pattern matches
    return 300; // 5 minutes
  }

  /**
   * Get keys matching a pattern (simplified implementation)
   * In production with Redis, you would use SCAN command
   */
  private async getKeysMatchingPattern(pattern: string): Promise<string[]> {
    // This is a simplified implementation
    // In a real Redis implementation, you would use the SCAN command
    // For now, we'll return an empty array as this would require direct Redis access
    this.logger.warn(`Pattern deletion not fully implemented for pattern: ${pattern}`);
    return [];
  }
}
