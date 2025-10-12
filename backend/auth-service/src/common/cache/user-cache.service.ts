import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';
import { RedisService } from '../redis/redis.service';
import { User } from '../http-client/user-service.client';

export interface CachedUser {
  user: User | null;
  timestamp: number;
}

/**
 * Specialized cache service for User data with memory leak prevention
 * Replaces the problematic Map-based cache in UserServiceClient
 */
@Injectable()
export class UserCacheService extends CacheService<string, CachedUser> {
  private readonly userLogger = new Logger(UserCacheService.name);

  constructor(redisService: RedisService) {
    super(redisService, {
      maxSize: 10000, // Limit to 10,000 user records as per task requirements
      ttl: 5 * 60 * 1000, // 5 minutes TTL as per task requirements
      name: 'UserCache',
      useRedis: true,
      redisKeyPrefix: 'auth-service:user-cache'
    });
    
    this.userLogger.log('UserCacheService initialized with LRU cache (max: 10,000, TTL: 5min)');
  }

  /**
   * Get cached user by email with automatic timestamp validation
   */
  async getCachedUserByEmail(email: string): Promise<User | null | undefined> {
    const cacheKey = `email:${email}`;
    return this.getCachedUserInternal(cacheKey);
  }

  /**
   * Get cached user by ID with automatic timestamp validation
   */
  async getCachedUserById(id: string): Promise<User | null | undefined> {
    const cacheKey = `id:${id}`;
    return this.getCachedUserInternal(cacheKey);
  }

  /**
   * Cache user by email
   */
  async setCachedUserByEmail(email: string, user: User | null): Promise<void> {
    const cacheKey = `email:${email}`;
    await this.setCachedUserInternal(cacheKey, user);
  }

  /**
   * Cache user by ID
   */
  async setCachedUserById(id: string, user: User | null): Promise<void> {
    const cacheKey = `id:${id}`;
    await this.setCachedUserInternal(cacheKey, user);
  }

  /**
   * Cache user by both email and ID (for newly created users)
   */
  async setCachedUser(user: User): Promise<void> {
    await Promise.all([
      this.setCachedUserById(user.id, user),
      this.setCachedUserByEmail(user.email, user)
    ]);
  }

  /**
   * Invalidate cache for a specific user (removes both email and ID entries)
   */
  async invalidateUser(userId: string): Promise<void> {
    // Remove by ID
    await this.delete(`id:${userId}`);
    
    // Find and remove by email (we need to search through local cache)
    const localEntries = this.getLocalEntries();
    for (const [key, cachedData] of localEntries) {
      if (key.startsWith('email:') && cachedData.user?.id === userId) {
        await this.delete(key);
        break;
      }
    }
    
    this.userLogger.debug(`Invalidated cache for user: ${userId}`);
  }

  /**
   * Get expired cache entry (for fallback when services are unavailable)
   */
  async getExpiredCacheByEmail(email: string): Promise<User | null> {
    const cacheKey = `email:${email}`;
    return this.getExpiredCacheInternal(cacheKey);
  }

  /**
   * Get expired cache entry by ID (for fallback when services are unavailable)
   */
  async getExpiredCacheById(id: string): Promise<User | null> {
    const cacheKey = `id:${id}`;
    return this.getExpiredCacheInternal(cacheKey);
  }

  /**
   * Get cache statistics specific to user caching
   */
  getUserCacheStats() {
    const baseStats = this.getStats();
    const info = this.getCacheInfo();
    
    return {
      ...baseStats,
      estimatedUsers: Math.floor(baseStats.localSize / 2), // Assuming each user has 2 entries (email + id)
      memoryPerUser: baseStats.localSize > 0 ? Math.round(baseStats.memoryUsage / baseStats.localSize) : 0,
      isNearCapacity: info.memoryPressure > 0.8,
      recommendedAction: this.getRecommendedAction(info)
    };
  }

  /**
   * Internal method to get cached user with timestamp validation
   */
  private async getCachedUserInternal(cacheKey: string): Promise<User | null | undefined> {
    try {
      const cached = await this.get(cacheKey);
      if (!cached) {
        return undefined;
      }
      
      // Check if cache entry is still valid (this is handled by LRU cache TTL, but double-check)
      const now = Date.now();
      const age = now - cached.timestamp;
      const maxAge = 5 * 60 * 1000; // 5 minutes
      
      if (age > maxAge) {
        // Entry is expired, remove it
        await this.delete(cacheKey);
        return undefined;
      }
      
      return cached.user;
    } catch (error) {
      this.userLogger.error(`Error getting cached user for key ${cacheKey}: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Internal method to set cached user with timestamp
   */
  private async setCachedUserInternal(cacheKey: string, user: User | null): Promise<void> {
    try {
      const cachedData: CachedUser = {
        user,
        timestamp: Date.now()
      };
      
      await this.set(cacheKey, cachedData);
    } catch (error) {
      this.userLogger.error(`Error setting cached user for key ${cacheKey}: ${error.message}`);
      // Don't throw error, caching is not critical
    }
  }

  /**
   * Get expired cache entry for fallback scenarios
   */
  private async getExpiredCacheInternal(cacheKey: string): Promise<User | null> {
    try {
      // Try to get from local cache even if expired
      const localEntries = this.getLocalEntries();
      for (const [key, cachedData] of localEntries) {
        if (key === cacheKey) {
          this.userLogger.warn(`Using expired cache for fallback: ${cacheKey}`);
          return cachedData.user;
        }
      }
      
      return null;
    } catch (error) {
      this.userLogger.error(`Error getting expired cache for key ${cacheKey}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get recommended action based on cache performance
   */
  private getRecommendedAction(info: any): string {
    if (info.memoryPressure > 0.9) {
      return 'CRITICAL: Increase cache size or reduce TTL immediately';
    } else if (info.memoryPressure > 0.8) {
      return 'WARNING: Consider increasing cache size or reducing TTL';
    } else if (info.stats.hitRatio < 50) {
      return 'INFO: Low hit ratio, consider reviewing cache strategy';
    } else if (info.stats.localHitRatio < 70) {
      return 'INFO: Consider increasing local cache size for better performance';
    } else {
      return 'OK: Cache performance is healthy';
    }
  }
}