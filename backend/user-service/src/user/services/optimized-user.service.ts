import { Injectable, Logger } from '@nestjs/common';
import {
  OptimizedUserRepository,
  CursorPaginationOptions,
  CursorPaginationResult,
  BatchOperationOptions,
  UserSearchFilters,
} from '../repositories/optimized-user.repository';
import { User } from '../entities/user.entity';
import { CacheService } from '../../common/cache/cache.service';

export interface UserPerformanceMetrics {
  queryExecutionTime: number;
  cacheHitRate: number;
  totalQueries: number;
  slowQueries: number;
}

/**
 * Optimized User Service that leverages the OptimizedUserRepository
 * for high-performance operations with large datasets
 */
@Injectable()
export class OptimizedUserService {
  private readonly logger = new Logger(OptimizedUserService.name);
  private performanceMetrics: UserPerformanceMetrics = {
    queryExecutionTime: 0,
    cacheHitRate: 0,
    totalQueries: 0,
    slowQueries: 0,
  };

  constructor(
    private readonly optimizedUserRepository: OptimizedUserRepository,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get users with cursor-based pagination for efficient large dataset handling
   */
  async getUsersWithPagination(
    options: CursorPaginationOptions = {},
  ): Promise<CursorPaginationResult<User>> {
    const startTime = Date.now();

    try {
      const result =
        await this.optimizedUserRepository.findWithCursorPagination(options);

      // Cache the results for future requests
      if (result.data.length > 0) {
        await this.cacheUsersInBatch(result.data);
      }

      this.updatePerformanceMetrics(startTime);
      return result;
    } catch (error) {
      this.logger.error('Error in getUsersWithPagination:', error);
      throw error;
    }
  }

  /**
   * Search users with advanced filters and pagination
   */
  async searchUsersWithFilters(
    filters: UserSearchFilters,
    paginationOptions: CursorPaginationOptions = {},
  ): Promise<CursorPaginationResult<User>> {
    const startTime = Date.now();

    try {
      const result =
        await this.optimizedUserRepository.findWithFiltersAndPagination(
          filters,
          paginationOptions,
        );

      // Cache the results
      if (result.data.length > 0) {
        await this.cacheUsersInBatch(result.data);
      }

      this.updatePerformanceMetrics(startTime);
      return result;
    } catch (error) {
      this.logger.error('Error in searchUsersWithFilters:', error);
      throw error;
    }
  }

  /**
   * Get multiple users by IDs with optimized batch processing and caching
   */
  async getUsersByIdsBatch(
    ids: string[],
    options: BatchOperationOptions = {},
  ): Promise<Map<string, User>> {
    if (ids.length === 0) {
      return new Map();
    }

    const startTime = Date.now();
    const result = new Map<string, User>();

    try {
      // First, try to get users from cache
      const cachedUsers = await this.cacheService.getUsersBatch(ids);
      const cachedIds = new Set<string>();

      // Add cached users to result
      for (const [id, user] of cachedUsers) {
        if (user) {
          result.set(id, user);
          cachedIds.add(id);
        }
      }

      // Get remaining IDs that weren't in cache
      const uncachedIds = ids.filter((id) => !cachedIds.has(id));

      if (uncachedIds.length > 0) {
        // Fetch uncached users from database
        const dbUsers = await this.optimizedUserRepository.findByIdsBatch(
          uncachedIds,
          options,
        );

        // Add to result and cache
        for (const user of dbUsers) {
          result.set(user.id, user);
          // Cache individual users for future requests
          await this.cacheService.setUser(user);
        }
      }

      this.updatePerformanceMetrics(startTime, cachedIds.size, ids.length);
      return result;
    } catch (error) {
      this.logger.error('Error in getUsersByIdsBatch:', error);
      throw error;
    }
  }

  /**
   * Create multiple users with optimized batch processing
   */
  async createUsersBatch(
    userData: Partial<User>[],
    options: BatchOperationOptions = {},
  ): Promise<User[]> {
    if (userData.length === 0) {
      return [];
    }

    const startTime = Date.now();

    try {
      const createdUsers = await this.optimizedUserRepository.createBatch(
        userData,
        options,
      );

      // Cache the newly created users
      await this.cacheUsersInBatch(createdUsers);

      this.updatePerformanceMetrics(startTime);
      this.logger.log(
        `Successfully created ${createdUsers.length} users in batch`,
      );

      return createdUsers;
    } catch (error) {
      this.logger.error('Error in createUsersBatch:', error);
      throw error;
    }
  }

  /**
   * Update multiple users with optimized batch processing
   */
  async updateUsersBatch(
    updates: Array<{ id: string; data: Partial<User> }>,
    options: BatchOperationOptions = {},
  ): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    const startTime = Date.now();

    try {
      await this.optimizedUserRepository.updateBatch(updates, options);

      // Invalidate cache for updated users
      const userIds = updates.map((update) => update.id);
      await this.invalidateUsersCache(userIds);

      this.updatePerformanceMetrics(startTime);
      this.logger.log(`Successfully updated ${updates.length} users in batch`);
    } catch (error) {
      this.logger.error('Error in updateUsersBatch:', error);
      throw error;
    }
  }

  /**
   * Soft delete multiple users with optimized batch processing
   */
  async softDeleteUsersBatch(
    ids: string[],
    options: BatchOperationOptions = {},
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const startTime = Date.now();

    try {
      await this.optimizedUserRepository.softDeleteBatch(ids, options);

      // Invalidate cache for deleted users
      await this.invalidateUsersCache(ids);

      this.updatePerformanceMetrics(startTime);
      this.logger.log(`Successfully soft deleted ${ids.length} users in batch`);
    } catch (error) {
      this.logger.error('Error in softDeleteUsersBatch:', error);
      throw error;
    }
  }

  /**
   * Get recently active users with pagination
   */
  async getRecentlyActiveUsers(
    days: number = 30,
    paginationOptions: CursorPaginationOptions = {},
  ): Promise<CursorPaginationResult<User>> {
    const startTime = Date.now();

    try {
      const result = await this.optimizedUserRepository.findRecentlyActiveUsers(
        days,
        paginationOptions,
      );

      // Cache the results
      if (result.data.length > 0) {
        await this.cacheUsersInBatch(result.data);
      }

      this.updatePerformanceMetrics(startTime);
      return result;
    } catch (error) {
      this.logger.error('Error in getRecentlyActiveUsers:', error);
      throw error;
    }
  }

  /**
   * Get users by email domain with pagination
   */
  async getUsersByEmailDomain(
    domain: string,
    paginationOptions: CursorPaginationOptions = {},
  ): Promise<CursorPaginationResult<User>> {
    const startTime = Date.now();

    try {
      const result = await this.optimizedUserRepository.findByEmailDomain(
        domain,
        paginationOptions,
      );

      // Cache the results
      if (result.data.length > 0) {
        await this.cacheUsersInBatch(result.data);
      }

      this.updatePerformanceMetrics(startTime);
      return result;
    } catch (error) {
      this.logger.error('Error in getUsersByEmailDomain:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive user statistics for monitoring and analytics
   */
  async getUserStatistics(): Promise<{
    userStats: any;
    performanceMetrics: UserPerformanceMetrics;
    cacheStats: any;
  }> {
    const startTime = Date.now();

    try {
      const [userStats, cacheStats] = await Promise.all([
        this.optimizedUserRepository.getUserStatistics(),
        this.cacheService.getCacheStats(),
      ]);

      this.updatePerformanceMetrics(startTime);

      return {
        userStats,
        performanceMetrics: { ...this.performanceMetrics },
        cacheStats,
      };
    } catch (error) {
      this.logger.error('Error in getUserStatistics:', error);
      throw error;
    }
  }

  /**
   * Get active users count with optional filters
   */
  async getActiveUsersCount(filters: UserSearchFilters = {}): Promise<number> {
    const startTime = Date.now();

    try {
      const count =
        await this.optimizedUserRepository.getActiveUsersCount(filters);
      this.updatePerformanceMetrics(startTime);
      return count;
    } catch (error) {
      this.logger.error('Error in getActiveUsersCount:', error);
      throw error;
    }
  }

  /**
   * Warm up cache with frequently accessed users
   */
  async warmUpCache(userIds: string[]): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    try {
      const users = await this.optimizedUserRepository.findByIdsBatch(userIds);
      await this.cacheUsersInBatch(users);

      this.logger.log(`Warmed up cache with ${users.length} users`);
    } catch (error) {
      this.logger.error('Error warming up cache:', error);
    }
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): UserPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Reset performance metrics (useful for monitoring intervals)
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      queryExecutionTime: 0,
      cacheHitRate: 0,
      totalQueries: 0,
      slowQueries: 0,
    };
  }

  /**
   * Private method to cache multiple users efficiently
   */
  private async cacheUsersInBatch(users: User[]): Promise<void> {
    try {
      const cachePromises = users.map((user) =>
        this.cacheService.setUser(user),
      );
      await Promise.all(cachePromises);
    } catch (error) {
      this.logger.warn('Error caching users in batch:', error);
      // Don't throw error as caching is not critical
    }
  }

  /**
   * Private method to invalidate cache for multiple users
   */
  private async invalidateUsersCache(userIds: string[]): Promise<void> {
    try {
      const invalidatePromises = userIds.map((id) =>
        this.cacheService.invalidateUser(id),
      );
      await Promise.all(invalidatePromises);
    } catch (error) {
      this.logger.warn('Error invalidating users cache:', error);
      // Don't throw error as cache invalidation failure is not critical
    }
  }

  /**
   * Private method to update performance metrics
   */
  private updatePerformanceMetrics(
    startTime: number,
    cacheHits: number = 0,
    totalRequests: number = 1,
  ): void {
    const executionTime = Date.now() - startTime;

    this.performanceMetrics.totalQueries++;
    this.performanceMetrics.queryExecutionTime =
      (this.performanceMetrics.queryExecutionTime + executionTime) / 2; // Moving average

    if (totalRequests > 0) {
      const hitRate = cacheHits / totalRequests;
      this.performanceMetrics.cacheHitRate =
        (this.performanceMetrics.cacheHitRate + hitRate) / 2; // Moving average
    }

    if (executionTime > 1000) {
      // Queries taking more than 1 second
      this.performanceMetrics.slowQueries++;
    }
  }
}
