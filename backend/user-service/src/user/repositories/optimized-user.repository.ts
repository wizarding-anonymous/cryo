import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import {
  CacheQuery,
  InvalidateCache,
  CacheConfigs,
  UserCache,
  TimeSensitiveCache,
} from '../../common/cache/cache-query.decorator';
import { CachedRepositoryBase } from '../../database/cached-repository.base';
import { TypeOrmQueryCacheService } from '../../common/cache/typeorm-query-cache.service';
import { SlowQueryMonitorService } from '../../database/slow-query-monitor.service';

export interface CursorPaginationOptions {
  cursor?: string;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'lastLoginAt';
  sortOrder?: 'ASC' | 'DESC';
}

export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount?: number;
}

export interface BatchOperationOptions {
  chunkSize?: number;
  skipErrors?: boolean;
  validateBeforeInsert?: boolean;
}

export interface UserSearchFilters {
  isActive?: boolean;
  hasLastLogin?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  emailDomain?: string;
}

/**
 * Optimized User Repository with advanced querying capabilities,
 * cursor-based pagination, batch operations, and automatic query caching
 */
@Injectable()
export class OptimizedUserRepository extends CachedRepositoryBase<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    dataSource: DataSource,
    cacheService: TypeOrmQueryCacheService,
    slowQueryMonitor: SlowQueryMonitorService,
  ) {
    super(User, dataSource, cacheService, slowQueryMonitor);
  }

  /**
   * Find users with cursor-based pagination for large datasets
   * More efficient than offset-based pagination for large tables
   */
  @CacheQuery(CacheConfigs.MEDIUM)
  async findWithCursorPagination(
    options: CursorPaginationOptions = {},
  ): Promise<CursorPaginationResult<User>> {
    const {
      cursor,
      limit = 100,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = options;

    // Validate limit to prevent excessive memory usage
    const safeLimit = Math.min(limit, 1000);

    // Build SQL query
    const whereConditions = ['deleted_at IS NULL'];
    const parameters: any[] = [];
    let paramIndex = 1;

    // Apply cursor condition for pagination
    if (cursor) {
      const cursorDate = new Date(cursor);
      const operator = sortOrder === 'DESC' ? '<' : '>';
      whereConditions.push(`${sortBy} ${operator} $${paramIndex}`);
      parameters.push(cursorDate);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');
    const orderDirection = sortOrder === 'DESC' ? 'DESC' : 'ASC';

    const query = `
      SELECT * FROM users 
      WHERE ${whereClause}
      ORDER BY ${sortBy} ${orderDirection}
      LIMIT ${safeLimit + 1}
    `;

    // Execute with caching
    const users = await this.executeCachedQuery<User[]>(query, parameters, {
      ttl: 300, // 5 minutes
      tags: ['users', 'pagination'],
    });

    const hasMore = users.length > safeLimit;

    if (hasMore) {
      users.pop(); // Remove the extra record used for hasMore check
    }

    const nextCursor =
      hasMore && users.length > 0
        ? users[users.length - 1][sortBy]?.toISOString()
        : undefined;

    return {
      data: users,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Find users with advanced filtering and cursor pagination
   */
  @CacheQuery(CacheConfigs.SEARCH)
  async findWithFiltersAndPagination(
    filters: UserSearchFilters,
    paginationOptions: CursorPaginationOptions = {},
  ): Promise<CursorPaginationResult<User>> {
    const {
      cursor,
      limit = 100,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = paginationOptions;

    const safeLimit = Math.min(limit, 1000);

    // Build SQL query with filters
    const whereConditions = ['deleted_at IS NULL'];
    const parameters: any[] = [];
    let paramIndex = 1;

    // Apply filters
    if (filters.isActive !== undefined) {
      whereConditions.push(`is_active = $${paramIndex}`);
      parameters.push(filters.isActive);
      paramIndex++;
    }

    if (filters.hasLastLogin !== undefined) {
      if (filters.hasLastLogin) {
        whereConditions.push('last_login_at IS NOT NULL');
      } else {
        whereConditions.push('last_login_at IS NULL');
      }
    }

    if (filters.createdAfter) {
      whereConditions.push(`created_at >= $${paramIndex}`);
      parameters.push(filters.createdAfter);
      paramIndex++;
    }

    if (filters.createdBefore) {
      whereConditions.push(`created_at <= $${paramIndex}`);
      parameters.push(filters.createdBefore);
      paramIndex++;
    }

    if (filters.emailDomain) {
      whereConditions.push(`email LIKE $${paramIndex}`);
      parameters.push(`%@${filters.emailDomain}`);
      paramIndex++;
    }

    // Apply cursor condition
    if (cursor) {
      const cursorDate = new Date(cursor);
      const operator = sortOrder === 'DESC' ? '<' : '>';
      whereConditions.push(`${sortBy} ${operator} $${paramIndex}`);
      parameters.push(cursorDate);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');
    const orderDirection = sortOrder === 'DESC' ? 'DESC' : 'ASC';

    const query = `
      SELECT * FROM users 
      WHERE ${whereClause}
      ORDER BY ${sortBy} ${orderDirection}
      LIMIT ${safeLimit + 1}
    `;

    // Execute with caching
    const users = await this.executeCachedQuery<User[]>(query, parameters, {
      ttl: 180, // 3 minutes
      tags: ['users', 'search', 'filtered'],
    });

    const hasMore = users.length > safeLimit;

    if (hasMore) {
      users.pop(); // Remove the extra record used for hasMore check
    }

    const nextCursor =
      hasMore && users.length > 0
        ? users[users.length - 1][sortBy]?.toISOString()
        : undefined;

    return {
      data: users,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Batch find users by IDs with optimized query and caching
   * Uses IN clause with chunking for large ID arrays
   */
  @CacheQuery(CacheConfigs.USER)
  async findByIdsBatch(
    ids: string[],
    options: BatchOperationOptions = {},
  ): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }

    const { chunkSize = 1000 } = options;

    // For small arrays, use cached query
    if (ids.length <= chunkSize) {
      const query = `
        SELECT * FROM users 
        WHERE id = ANY($1) AND deleted_at IS NULL 
        ORDER BY created_at DESC
      `;

      return this.executeCachedQuery<User[]>(query, [ids], {
        ttl: 300, // 5 minutes
        tags: ['users', 'batch'],
        keyGenerator: () => `users:batch:${ids.sort().join(',')}`,
      });
    }

    // For large arrays, chunk the requests with caching
    const results: User[] = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);

      const query = `
        SELECT * FROM users 
        WHERE id = ANY($1) AND deleted_at IS NULL 
        ORDER BY created_at DESC
      `;

      const chunkResults = await this.executeCachedQuery<User[]>(
        query,
        [chunk],
        {
          ttl: 300,
          tags: ['users', 'batch'],
          keyGenerator: () => `users:batch:${chunk.sort().join(',')}`,
        },
      );

      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Batch create users with optimized insert
   * Uses chunked inserts for better performance and memory usage
   */
  @InvalidateCache(['users', 'statistics', 'search'])
  async createBatch(
    userData: Partial<User>[],
    options: BatchOperationOptions = {},
  ): Promise<User[]> {
    if (userData.length === 0) {
      return [];
    }

    const { chunkSize = 500, validateBeforeInsert = true } = options;

    // Validate data if requested
    if (validateBeforeInsert) {
      this.validateUserDataBatch(userData);
    }

    const results: User[] = [];

    // Process in chunks to avoid memory issues and database limits
    for (let i = 0; i < userData.length; i += chunkSize) {
      const chunk = userData.slice(i, i + chunkSize);

      try {
        // Use insert for better performance than save
        const insertResult = await this.userRepository
          .createQueryBuilder()
          .insert()
          .into(User)
          .values(chunk)
          .returning('*')
          .execute();

        results.push(...(insertResult.generatedMaps as User[]));
      } catch (error) {
        if (options.skipErrors) {
          console.error(`Error inserting chunk ${i / chunkSize + 1}:`, error);
          continue;
        }
        throw error;
      }
    }

    return results;
  }

  /**
   * Batch update users with optimized queries
   * Uses case-when statements for efficient bulk updates
   */
  @InvalidateCache(['users', 'profiles', 'search', 'statistics'])
  async updateBatch(
    updates: Array<{ id: string; data: Partial<User> }>,
    options: BatchOperationOptions = {},
  ): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    const { chunkSize = 500 } = options;

    // Process in chunks
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);

      try {
        await this.performBatchUpdate(chunk);
      } catch (error) {
        if (options.skipErrors) {
          console.error(`Error updating chunk ${i / chunkSize + 1}:`, error);
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Batch soft delete users
   */
  @InvalidateCache(['users', 'statistics', 'search'])
  async softDeleteBatch(
    ids: string[],
    options: BatchOperationOptions = {},
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const { chunkSize = 1000 } = options;

    // Process in chunks
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);

      try {
        await this.userRepository
          .createQueryBuilder()
          .update(User)
          .set({ deletedAt: new Date() })
          .where('id IN (:...ids)', { ids: chunk })
          .andWhere('deletedAt IS NULL')
          .execute();
      } catch (error) {
        if (options.skipErrors) {
          console.error(
            `Error soft deleting chunk ${i / chunkSize + 1}:`,
            error,
          );
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Get active users count with optional filters
   */
  @TimeSensitiveCache(['statistics'])
  async getActiveUsersCount(filters: UserSearchFilters = {}): Promise<number> {
    let query = this.userRepository
      .createQueryBuilder('user')
      .where('user.deletedAt IS NULL')
      .andWhere('user.isActive = :isActive', { isActive: true });

    // Apply additional filters
    if (filters.hasLastLogin !== undefined) {
      if (filters.hasLastLogin) {
        query = query.andWhere('user.lastLoginAt IS NOT NULL');
      } else {
        query = query.andWhere('user.lastLoginAt IS NULL');
      }
    }

    if (filters.createdAfter) {
      query = query.andWhere('user.createdAt >= :createdAfter', {
        createdAfter: filters.createdAfter,
      });
    }

    if (filters.createdBefore) {
      query = query.andWhere('user.createdAt <= :createdBefore', {
        createdBefore: filters.createdBefore,
      });
    }

    return query.getCount();
  }

  /**
   * Find users by email domain with pagination
   */
  async findByEmailDomain(
    domain: string,
    paginationOptions: CursorPaginationOptions = {},
  ): Promise<CursorPaginationResult<User>> {
    return this.findWithFiltersAndPagination(
      { emailDomain: domain },
      paginationOptions,
    );
  }

  /**
   * Find recently active users (logged in within specified days)
   */
  async findRecentlyActiveUsers(
    days: number = 30,
    paginationOptions: CursorPaginationOptions = {},
  ): Promise<CursorPaginationResult<User>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const {
      cursor,
      limit = 100,
      sortBy = 'lastLoginAt',
      sortOrder = 'DESC',
    } = paginationOptions;

    const safeLimit = Math.min(limit, 1000);

    let query = this.userRepository
      .createQueryBuilder('user')
      .where('user.deletedAt IS NULL')
      .andWhere('user.isActive = :isActive', { isActive: true })
      .andWhere('user.lastLoginAt >= :cutoffDate', { cutoffDate })
      .orderBy(`user.${sortBy}`, sortOrder);

    if (cursor) {
      const cursorDate = new Date(cursor);
      const operator = sortOrder === 'DESC' ? '<' : '>';
      query = query.andWhere(`user.${sortBy} ${operator} :cursor`, {
        cursor: cursorDate,
      });
    }

    query = query.limit(safeLimit + 1);

    const users = await query.getMany();
    const hasMore = users.length > safeLimit;

    if (hasMore) {
      users.pop();
    }

    const nextCursor =
      hasMore && users.length > 0
        ? users[users.length - 1][sortBy]?.toISOString()
        : undefined;

    return {
      data: users,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Get user statistics for monitoring with optimized caching
   */
  @TimeSensitiveCache(['statistics'])
  async getUserStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    usersWithRecentLogin: number;
    usersCreatedToday: number;
    usersCreatedThisWeek: number;
    usersCreatedThisMonth: number;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentLoginCutoff = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000,
    );

    // Use a single optimized query for all statistics
    const statisticsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE deleted_at IS NULL) as total_users,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND is_active = true) as active_users,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND is_active = false) as inactive_users,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND last_login_at >= $1) as users_with_recent_login,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND created_at >= $2) as users_created_today,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND created_at >= $3) as users_created_this_week,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND created_at >= $4) as users_created_this_month
      FROM users
    `;

    const result = await this.executeCachedQuery<any[]>(
      statisticsQuery,
      [recentLoginCutoff, today, weekAgo, monthAgo],
      {
        ttl: 60, // 1 minute for statistics
        tags: ['statistics', 'users', 'time-sensitive'],
        keyGenerator: () =>
          `user-statistics:${today.toISOString().split('T')[0]}`,
      },
    );

    const stats = result[0];

    return {
      totalUsers: parseInt(stats.total_users, 10),
      activeUsers: parseInt(stats.active_users, 10),
      inactiveUsers: parseInt(stats.inactive_users, 10),
      usersWithRecentLogin: parseInt(stats.users_with_recent_login, 10),
      usersCreatedToday: parseInt(stats.users_created_today, 10),
      usersCreatedThisWeek: parseInt(stats.users_created_this_week, 10),
      usersCreatedThisMonth: parseInt(stats.users_created_this_month, 10),
    };
  }

  /**
   * Private method to perform batch updates using CASE-WHEN statements
   */
  private async performBatchUpdate(
    updates: Array<{ id: string; data: Partial<User> }>,
  ): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    // Group updates by field to optimize queries
    const fieldUpdates: Record<string, Array<{ id: string; value: any }>> = {};

    updates.forEach(({ id, data }) => {
      Object.entries(data).forEach(([field, value]) => {
        if (!fieldUpdates[field]) {
          fieldUpdates[field] = [];
        }
        fieldUpdates[field].push({ id, value });
      });
    });

    // Execute updates for each field
    for (const [field, fieldData] of Object.entries(fieldUpdates)) {
      if (fieldData.length === 0) continue;

      const ids = fieldData.map((item) => item.id);
      let caseStatement = `CASE id `;
      const parameters: Record<string, any> = {};

      fieldData.forEach((item, index) => {
        const paramKey = `value_${index}`;
        caseStatement += `WHEN :id_${index} THEN :${paramKey} `;
        parameters[`id_${index}`] = item.id;
        parameters[paramKey] = item.value;
      });

      caseStatement += `END`;

      await this.userRepository
        .createQueryBuilder()
        .update(User)
        .set({ [field]: () => caseStatement })
        .where('id IN (:...ids)', { ids })
        .setParameters(parameters)
        .execute();
    }
  }

  /**
   * Validate user data batch before insertion
   */
  private validateUserDataBatch(userData: Partial<User>[]): void {
    const errors: string[] = [];

    userData.forEach((user, index) => {
      if (!user.email) {
        errors.push(`User at index ${index}: email is required`);
      }
      if (!user.name) {
        errors.push(`User at index ${index}: name is required`);
      }
      if (!user.password) {
        errors.push(`User at index ${index}: password is required`);
      }
    });

    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join(', ')}`);
    }
  }
}
