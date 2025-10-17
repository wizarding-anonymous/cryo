import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../entities/user.entity';
import { OptimizedCacheService } from '../../common/cache/optimized-cache.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { CreateUserDto, UpdateProfileDto } from '../dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/**
 * Performance-optimized User Service with advanced caching and query optimization
 */
@Injectable()
export class PerformanceOptimizedUserService {
  private readonly logger = new Logger(PerformanceOptimizedUserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cacheService: OptimizedCacheService,
    private readonly metricsService: MetricsService,
  ) { }

  /**
   * Find user by ID with optimized caching
   */
  async findById(id: string): Promise<User | null> {
    const startTime = Date.now();
    const cacheKey = `user:${id}`;

    try {
      // Try cache first
      const cached = await this.cacheService.get<User>(cacheKey, 'USER_BASIC');
      if (cached) {
        this.recordMetrics('findById', 'cache_hit', Date.now() - startTime);
        return cached;
      }

      // Query database with optimized select
      const user = await this.userRepository.findOne({
        where: { id, deletedAt: null },
        select: [
          'id', 'email', 'name', 'isActive', 'lastLoginAt',
          'createdAt', 'updatedAt', 'avatarUrl'
        ],
      });

      if (user) {
        // Cache the result
        await this.cacheService.set(cacheKey, user, 'USER_BASIC');
        this.recordMetrics('findById', 'db_hit', Date.now() - startTime);
        return user;
      }

      this.recordMetrics('findById', 'not_found', Date.now() - startTime);
      return null;
    } catch (error) {
      this.logger.error(`Error finding user by ID ${id}:`, error);
      this.recordMetrics('findById', 'error', Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Find user by email with caching
   */
  async findByEmail(email: string): Promise<User | null> {
    const startTime = Date.now();
    const cacheKey = `user:email:${email.toLowerCase()}`;

    try {
      // Try cache first
      const cached = await this.cacheService.get<User>(cacheKey, 'USER_BASIC');
      if (cached) {
        this.recordMetrics('findByEmail', 'cache_hit', Date.now() - startTime);
        return cached;
      }

      // Query database with index-optimized query
      const user = await this.userRepository.findOne({
        where: {
          email: email.toLowerCase(),
          deletedAt: null
        },
        select: [
          'id', 'email', 'name', 'password', 'isActive',
          'lastLoginAt', 'createdAt', 'updatedAt'
        ],
      });

      if (user) {
        // Cache with both email and ID keys
        await Promise.all([
          this.cacheService.set(cacheKey, user, 'USER_BASIC'),
          this.cacheService.set(`user:${user.id}`, user, 'USER_BASIC'),
        ]);
        this.recordMetrics('findByEmail', 'db_hit', Date.now() - startTime);
        return user;
      }

      this.recordMetrics('findByEmail', 'not_found', Date.now() - startTime);
      return null;
    } catch (error) {
      this.logger.error(`Error finding user by email ${email}:`, error);
      this.recordMetrics('findByEmail', 'error', Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Batch find users by IDs with optimized caching
   */
  async findByIds(ids: string[]): Promise<User[]> {
    const startTime = Date.now();

    try {
      if (ids.length === 0) return [];

      // Prepare cache keys
      const cacheKeys = ids.map(id => `user:${id}`);

      // Try batch cache lookup
      const cachedResults = await this.cacheService.getBatch<User>(cacheKeys, 'USER_BASIC');

      // Identify missing IDs
      const missingIds = ids.filter(id => !cachedResults.has(`user:${id}`));

      let dbResults: User[] = [];

      // Query database for missing users in batches
      if (missingIds.length > 0) {
        dbResults = await this.findMissingUsersInBatches(missingIds);

        // Cache the database results
        const cacheItems = new Map<string, User>();
        dbResults.forEach(user => {
          cacheItems.set(`user:${user.id}`, user);
        });

        if (cacheItems.size > 0) {
          await this.cacheService.setBatch(cacheItems, 'USER_BASIC');
        }
      }

      // Combine cached and database results
      const allResults: User[] = [];

      // Add cached results
      for (const user of cachedResults.values()) {
        allResults.push(user);
      }

      // Add database results
      allResults.push(...dbResults);

      this.recordBatchMetrics('findByIds', ids.length, cachedResults.size, dbResults.length, Date.now() - startTime);

      return allResults;
    } catch (error) {
      this.logger.error(`Error in batch find by IDs:`, error);
      this.recordMetrics('findByIds', 'error', Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Create user with cache invalidation
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    const startTime = Date.now();

    try {
      // Create user in database
      const user = this.userRepository.create({
        ...createUserDto,
        email: createUserDto.email.toLowerCase(),
      });

      const savedUser = await this.userRepository.save(user);

      // Cache the new user
      await Promise.all([
        this.cacheService.set(`user:${savedUser.id}`, savedUser, 'USER_BASIC'),
        this.cacheService.set(`user:email:${savedUser.email}`, savedUser, 'USER_BASIC'),
      ]);

      this.recordMetrics('create', 'success', Date.now() - startTime);
      return savedUser;
    } catch (error) {
      this.logger.error(`Error creating user:`, error);
      this.recordMetrics('create', 'error', Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Update user with cache invalidation
   */
  async update(id: string, updateUserDto: UpdateProfileDto): Promise<User> {
    const startTime = Date.now();

    try {
      // Find existing user
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      // Update user in database
      await this.userRepository.update(id, updateUserDto);

      // Get updated user
      const updatedUser = await this.userRepository.findOne({
        where: { id, deletedAt: null },
      });

      if (!updatedUser) {
        throw new NotFoundException(`User with ID ${id} not found after update`);
      }

      // Invalidate and update cache
      await Promise.all([
        this.cacheService.invalidate(`user:${id}`),
        this.cacheService.invalidate(`user:email:${existingUser.email}`),
        this.cacheService.set(`user:${id}`, updatedUser, 'USER_BASIC'),
        this.cacheService.set(`user:email:${updatedUser.email}`, updatedUser, 'USER_BASIC'),
      ]);

      this.recordMetrics('update', 'success', Date.now() - startTime);
      return updatedUser;
    } catch (error) {
      this.logger.error(`Error updating user ${id}:`, error);
      this.recordMetrics('update', 'error', Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Soft delete user with cache invalidation
   */
  async softDelete(id: string): Promise<void> {
    const startTime = Date.now();

    try {
      const user = await this.findById(id);
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      // Soft delete in database
      await this.userRepository.update(id, {
        deletedAt: new Date(),
        isActive: false,
      });

      // Invalidate cache
      await Promise.all([
        this.cacheService.invalidate(`user:${id}`),
        this.cacheService.invalidate(`user:email:${user.email}`),
      ]);

      this.recordMetrics('softDelete', 'success', Date.now() - startTime);
    } catch (error) {
      this.logger.error(`Error soft deleting user ${id}:`, error);
      this.recordMetrics('softDelete', 'error', Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Find active users with cursor-based pagination (optimized for large datasets)
   */
  async findActiveUsers(pagination: PaginationQueryDto): Promise<{ users: User[]; hasMore: boolean; nextCursor?: string }> {
    const startTime = Date.now();

    try {
      const { limit = 20, cursor } = pagination;
      const queryLimit = Math.min(limit, 100); // Cap at 100 for performance

      let query = this.userRepository
        .createQueryBuilder('user')
        .select([
          'user.id', 'user.email', 'user.name', 'user.isActive',
          'user.lastLoginAt', 'user.createdAt', 'user.avatarUrl'
        ])
        .where('user.deletedAt IS NULL')
        .andWhere('user.isActive = :isActive', { isActive: true })
        .orderBy('user.createdAt', 'DESC')
        .limit(queryLimit + 1); // Get one extra to check if there are more

      if (cursor) {
        query = query.andWhere('user.createdAt < :cursor', {
          cursor: new Date(cursor)
        });
      }

      const users = await query.getMany();
      const hasMore = users.length > queryLimit;

      if (hasMore) {
        users.pop(); // Remove the extra user
      }

      const nextCursor = hasMore && users.length > 0
        ? users[users.length - 1].createdAt.toISOString()
        : undefined;

      this.recordMetrics('findActiveUsers', 'success', Date.now() - startTime);

      return { users, hasMore, nextCursor };
    } catch (error) {
      this.logger.error(`Error finding active users:`, error);
      this.recordMetrics('findActiveUsers', 'error', Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Update last login time (optimized for frequent updates)
   */
  async updateLastLogin(id: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Direct database update without full object retrieval
      await this.userRepository.update(id, {
        lastLoginAt: new Date()
      });

      // Invalidate cache to ensure consistency
      await this.cacheService.invalidate(`user:${id}`);

      this.recordMetrics('updateLastLogin', 'success', Date.now() - startTime);
    } catch (error) {
      this.logger.error(`Error updating last login for user ${id}:`, error);
      this.recordMetrics('updateLastLogin', 'error', Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Get user statistics (cached for performance)
   */
  async getUserStats(): Promise<{ total: number; active: number; inactive: number }> {
    const startTime = Date.now();
    const cacheKey = 'user:stats';

    try {
      // Try cache first
      const cached = await this.cacheService.get<any>(cacheKey, 'USER_STATS');
      if (cached) {
        this.recordMetrics('getUserStats', 'cache_hit', Date.now() - startTime);
        return cached;
      }

      // Query database with optimized aggregation
      const [total, active] = await Promise.all([
        this.userRepository.count({ where: { deletedAt: null } }),
        this.userRepository.count({ where: { deletedAt: null, isActive: true } }),
      ]);

      const stats = {
        total,
        active,
        inactive: total - active,
      };

      // Cache the results
      await this.cacheService.set(cacheKey, stats, 'USER_STATS');

      this.recordMetrics('getUserStats', 'db_hit', Date.now() - startTime);
      return stats;
    } catch (error) {
      this.logger.error(`Error getting user stats:`, error);
      this.recordMetrics('getUserStats', 'error', Date.now() - startTime);
      throw error;
    }
  }

  // Private helper methods

  /**
   * Find missing users in optimized batches
   */
  private async findMissingUsersInBatches(ids: string[]): Promise<User[]> {
    const batchSize = 100; // Optimal batch size for PostgreSQL IN queries
    const results: User[] = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);

      const batchResults = await this.userRepository.find({
        where: {
          id: In(batch),
          deletedAt: null
        },
        select: [
          'id', 'email', 'name', 'isActive', 'lastLoginAt',
          'createdAt', 'updatedAt', 'avatarUrl'
        ],
      });

      results.push(...batchResults);
    }

    return results;
  }

  // Metrics recording methods

  private recordMetrics(operation: string, result: string, duration: number): void {
    const status = result === 'error' ? 'error' : 'success';
    this.metricsService.recordUserOperation(operation, status, duration);
  }

  private recordBatchMetrics(
    operation: string,
    requested: number,
    cached: number,
    dbQueries: number,
    duration: number
  ): void {
    // Record batch operation
    this.metricsService.recordBatchOperation(operation, 'success', requested, duration);
    
    // Record cache efficiency
    if (cached > 0) {
      this.metricsService.recordCacheOperation('hit', 'batch');
    }
    if (requested - cached > 0) {
      this.metricsService.recordCacheOperation('miss', 'batch');
    }
    
    // Record database operations if any
    if (dbQueries > 0) {
      this.metricsService.recordDatabaseOperation('batch_select', 'users', 'success', duration);
    }
    
    // Log batch operation efficiency for monitoring
    const cacheHitRatio = cached / requested;
    this.logger.debug(`Batch operation ${operation}: ${cached}/${requested} cached (${Math.round(cacheHitRatio * 100)}% hit rate)`);
  }
}