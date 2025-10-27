import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { User } from '../../user/entities/user.entity';
import {
  CacheStats,
  CacheMetricsData,
  CacheConfiguration,
  BatchCacheResult,
  Profile,
} from './interfaces/cache.interfaces';
import { CacheMetrics as PrometheusMetrics } from './cache.metrics';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name);
  private readonly namespace = 'user-service';

  // Cache statistics
  private stats = {
    hits: 0,
    misses: 0,
    totalLatency: 0,
    operations: 0,
  };

  // Default TTL values (in seconds)
  private readonly DEFAULT_USER_TTL = 300; // 5 minutes
  private readonly DEFAULT_PROFILE_TTL = 600; // 10 minutes
  private readonly DEFAULT_BATCH_TTL = 180; // 3 minutes

  constructor(
    private readonly redisService: RedisService,
    private readonly metrics: PrometheusMetrics,
    @Inject(forwardRef(() => MetricsService))
    private readonly metricsService?: MetricsService,
  ) {}

  async onModuleInit() {
    this.logger.log('CacheService initialized with Redis backend');
  }

  /**
   * Generate namespaced cache key
   */
  private getKey(type: string, identifier: string): string {
    return `${this.namespace}:${type}:${identifier}`;
  }

  /**
   * Record cache operation metrics
   */
  private recordMetrics(
    isHit: boolean,
    latency: number,
    cacheType: string = 'user',
    operation: string = 'get',
  ): void {
    this.stats.operations++;
    this.stats.totalLatency += latency;

    const latencySeconds = latency / 1000;

    if (isHit) {
      this.stats.hits++;
      this.metrics.recordCacheHit(cacheType, operation);
      // Record in new metrics service
      this.metricsService?.recordCacheOperation('hit', cacheType, latency);
    } else {
      this.stats.misses++;
      this.metrics.recordCacheMiss(cacheType, operation);
      // Record in new metrics service
      this.metricsService?.recordCacheOperation('miss', cacheType, latency);
    }

    this.metrics.recordCacheOperationDuration(
      cacheType,
      operation,
      latencySeconds,
    );

    // Update hit ratio periodically
    if (this.stats.operations % 100 === 0) {
      const hitRatio =
        this.stats.operations > 0 ? this.stats.hits / this.stats.operations : 0;
      this.metrics.updateCacheHitRatio(cacheType, hitRatio);
    }
  }

  /**
   * Get user from cache
   */
  async getUser(id: string): Promise<User | null> {
    const startTime = Date.now();

    try {
      const key = this.getKey('user', id);
      const cached = await this.redisService.get(key);

      const latency = Date.now() - startTime;
      this.recordMetrics(!!cached, latency, 'user', 'get');

      if (cached) {
        this.logger.debug(`Cache HIT for user ${id}`);
        return cached as User;
      }

      this.logger.debug(`Cache MISS for user ${id}`);
      return null;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.recordMetrics(false, latency, 'user', 'get');
      this.logger.error(`Cache get error for user ${id}: ${error.message}`);
      return null;
    }
  }

  /**
   * Set user in cache
   */
  async setUser(user: User, ttl?: number): Promise<void> {
    try {
      const key = this.getKey('user', user.id);
      const cacheTtl = ttl || this.DEFAULT_USER_TTL;

      await this.redisService.set(key, user, cacheTtl);
      this.logger.debug(`User ${user.id} cached with TTL ${cacheTtl}s`);
    } catch (error) {
      this.logger.error(
        `Cache set error for user ${user.id}: ${error.message}`,
      );
    }
  }

  /**
   * Invalidate user cache
   */
  async invalidateUser(id: string): Promise<void> {
    try {
      const userKey = this.getKey('user', id);
      const profileKey = this.getKey('profile', id);

      await Promise.all([
        this.redisService.del(userKey),
        this.redisService.del(profileKey),
      ]);

      this.logger.debug(`Cache invalidated for user ${id}`);
    } catch (error) {
      this.logger.error(
        `Cache invalidation error for user ${id}: ${error.message}`,
      );
    }
  }

  /**
   * Get multiple users from cache (batch operation)
   */
  async getUsersBatch(ids: string[]): Promise<Map<string, User>> {
    const startTime = Date.now();
    const result = new Map<string, User>();

    if (ids.length === 0) {
      return result;
    }

    try {
      // Generate keys for all user IDs
      const keys = ids.map((id) => this.getKey('user', id));

      // Use Redis MGET for efficient batch retrieval
      const client = this.redisService.getClient();
      const values = await client.mget(...keys);

      const latency = Date.now() - startTime;
      let hits = 0;

      // Process results
      values.forEach((value, index) => {
        if (value) {
          try {
            const user = JSON.parse(value) as User;
            result.set(ids[index], user);
            hits++;
          } catch (parseError) {
            this.logger.error(
              `Failed to parse cached user ${ids[index]}: ${parseError.message}`,
            );
          }
        }
      });

      // Record metrics for batch operation
      this.recordMetrics(hits > 0, latency, 'user', 'batch_get');
      this.metrics.recordBatchOperation(
        'getUsersBatch',
        'success',
        ids.length,
        latency / 1000,
      );

      this.logger.debug(`Batch cache operation: ${hits}/${ids.length} hits`);
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.recordMetrics(false, latency, 'user', 'batch_get');
      this.metrics.recordBatchOperation(
        'getUsersBatch',
        'error',
        ids.length,
        latency / 1000,
      );
      this.logger.error(`Batch cache get error: ${error.message}`);
      return result;
    }
  }

  /**
   * Set multiple users in cache (batch operation)
   */
  async setUsersBatch(users: User[], ttl?: number): Promise<void> {
    if (users.length === 0) {
      return;
    }

    try {
      const cacheTtl = ttl || this.DEFAULT_USER_TTL;
      const client = this.redisService.getClient();

      // Check if Redis client is available
      if (!client) {
        this.logger.warn('Redis client not available, skipping batch cache');
        return;
      }

      // Use Redis pipeline for efficient batch operations
      const pipeline = client.pipeline();

      if (!pipeline) {
        this.logger.warn('Redis pipeline not available, skipping batch cache');
        return;
      }

      users.forEach((user) => {
        const key = this.getKey('user', user.id);
        pipeline.setex(key, cacheTtl, JSON.stringify(user));
      });

      await pipeline.exec();

      this.logger.debug(
        `Batch cached ${users.length} users with TTL ${cacheTtl}s`,
      );
    } catch (error) {
      this.logger.error(`Batch cache set error: ${error.message}`);
    }
  }

  /**
   * Get profile from cache
   */
  async getProfile(userId: string): Promise<Profile | null> {
    const startTime = Date.now();

    try {
      const key = this.getKey('profile', userId);
      const cached = await this.redisService.get(key);

      const latency = Date.now() - startTime;
      this.recordMetrics(!!cached, latency, 'profile', 'get');

      if (cached) {
        this.logger.debug(`Cache HIT for profile ${userId}`);
        return cached as Profile;
      }

      this.logger.debug(`Cache MISS for profile ${userId}`);
      return null;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.recordMetrics(false, latency, 'profile', 'get');
      this.logger.error(
        `Cache get error for profile ${userId}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Set profile in cache
   */
  async setProfile(profile: Profile): Promise<void> {
    try {
      const key = this.getKey('profile', profile.userId);
      const cacheTtl = this.DEFAULT_PROFILE_TTL;

      await this.redisService.set(key, profile, cacheTtl);
      this.logger.debug(
        `Profile ${profile.userId} cached with TTL ${cacheTtl}s`,
      );
    } catch (error) {
      this.logger.error(
        `Cache set error for profile ${profile.userId}: ${error.message}`,
      );
    }
  }

  /**
   * Invalidate profile cache
   */
  async invalidateProfile(userId: string): Promise<void> {
    try {
      const key = this.getKey('profile', userId);
      await this.redisService.del(key);

      this.logger.debug(`Profile cache invalidated for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Profile cache invalidation error for user ${userId}: ${error.message}`,
      );
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    const totalOperations = this.stats.operations;
    const hitRatio =
      totalOperations > 0 ? this.stats.hits / totalOperations : 0;
    const averageLatency =
      totalOperations > 0 ? this.stats.totalLatency / totalOperations : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRatio: Math.round(hitRatio * 10000) / 100, // Percentage with 2 decimal places
      totalOperations,
      averageLatency: Math.round(averageLatency * 100) / 100, // Milliseconds with 2 decimal places
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      totalLatency: 0,
      operations: 0,
    };
    this.logger.debug('Cache statistics reset');
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUpCache(users: User[]): Promise<void> {
    if (users.length === 0) {
      return;
    }

    try {
      await this.setUsersBatch(users, this.DEFAULT_USER_TTL);
      this.logger.log(`Cache warmed up with ${users.length} users`);
    } catch (error) {
      this.logger.error(`Cache warm-up error: ${error.message}`);
    }
  }

  /**
   * Clear all cache entries for this service
   */
  async clearCache(): Promise<void> {
    try {
      const client = this.redisService.getClient();
      const pattern = `${this.namespace}:*`;

      // Get all keys matching the pattern
      const keys = await client.keys(pattern);

      if (keys.length > 0) {
        await client.del(...keys);
        this.logger.log(`Cleared ${keys.length} cache entries`);
      } else {
        this.logger.log('No cache entries to clear');
      }
    } catch (error) {
      this.logger.error(`Cache clear error: ${error.message}`);
    }
  }

  /**
   * Health check for cache service
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await this.redisService.healthCheck();
    } catch (error) {
      this.logger.error(`Cache health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get detailed cache metrics
   */
  async getCacheMetrics(): Promise<CacheMetricsData> {
    const stats = await this.getCacheStats();

    return {
      userCacheHits: this.stats.hits,
      userCacheMisses: this.stats.misses,
      profileCacheHits: 0, // TODO: Separate profile metrics
      profileCacheMisses: 0, // TODO: Separate profile metrics
      batchOperations: 0, // TODO: Track batch operations separately
      averageLatency: stats.averageLatency,
      lastResetTime: new Date(), // TODO: Track actual reset time
    };
  }

  /**
   * Update cache configuration
   */
  updateConfiguration(config: Partial<CacheConfiguration>): void {
    // TODO: Implement dynamic configuration updates
    this.logger.log('Cache configuration updated', config);
  }

  /**
   * Get cache configuration
   */
  getConfiguration(): CacheConfiguration {
    return {
      userTtl: this.DEFAULT_USER_TTL,
      profileTtl: this.DEFAULT_PROFILE_TTL,
      batchTtl: this.DEFAULT_BATCH_TTL,
      maxBatchSize: 100, // Default max batch size
      enableMetrics: true,
    };
  }

  /**
   * Advanced batch get with detailed results
   */
  async getUsersBatchAdvanced(ids: string[]): Promise<BatchCacheResult<User>> {
    const cached = await this.getUsersBatch(ids);
    const missing = ids.filter((id) => !cached.has(id));
    const hitRatio = ids.length > 0 ? cached.size / ids.length : 0;

    return {
      cached,
      missing,
      hitRatio: Math.round(hitRatio * 10000) / 100,
    };
  }

  /**
   * Preload cache with user data based on access patterns
   */
  preloadUsers(
    userIds: string[],
    priority: 'high' | 'medium' | 'low' = 'medium',
  ): void {
    const ttlMultiplier =
      priority === 'high' ? 2 : priority === 'medium' ? 1 : 0.5;
    const ttl = Math.floor(this.DEFAULT_USER_TTL * ttlMultiplier);

    this.logger.debug(
      `Preloading ${userIds.length} users with ${priority} priority (TTL: ${ttl}s)`,
    );

    // This would typically fetch from database and cache
    // For now, we'll just log the operation
    // TODO: Integrate with UserService to fetch and cache users
  }

  /**
   * Cache invalidation with pattern matching
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const client = this.redisService.getClient();
      const fullPattern = `${this.namespace}:${pattern}`;

      const keys = await client.keys(fullPattern);

      if (keys.length > 0) {
        await client.del(...keys);
        this.logger.debug(
          `Invalidated ${keys.length} cache entries matching pattern: ${pattern}`,
        );
        return keys.length;
      }

      return 0;
    } catch (error) {
      this.logger.error(
        `Pattern invalidation error for ${pattern}: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Get cache size and memory usage
   */
  async getCacheInfo(): Promise<{
    keyCount: number;
    memoryUsage: string;
    namespace: string;
  }> {
    try {
      const client = this.redisService.getClient();
      const pattern = `${this.namespace}:*`;
      const keys = await client.keys(pattern);

      // Get memory usage info (this is a simplified version)
      const info = await client.info('memory');
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'Unknown';

      return {
        keyCount: keys.length,
        memoryUsage,
        namespace: this.namespace,
      };
    } catch (error) {
      this.logger.error(`Cache info error: ${error.message}`);
      return {
        keyCount: 0,
        memoryUsage: 'Unknown',
        namespace: this.namespace,
      };
    }
  }
}
