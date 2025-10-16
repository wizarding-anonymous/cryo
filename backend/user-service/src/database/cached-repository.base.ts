import { Logger } from '@nestjs/common';
import {
  Repository,
  EntityTarget,
  DataSource,
  QueryRunner,
  SelectQueryBuilder,
} from 'typeorm';
import {
  TypeOrmQueryCacheService,
  QueryCacheOptions,
} from '../common/cache/typeorm-query-cache.service';
import { CachedQueryRunner } from '../common/cache/cached-query-runner';
import { SlowQueryMonitorService } from './slow-query-monitor.service';

/**
 * Base class for repositories with automatic query caching
 * Extends TypeORM Repository to provide transparent caching capabilities
 */
export class CachedRepositoryBase<Entity> extends Repository<Entity> {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    target: EntityTarget<Entity>,
    dataSource: DataSource,
    private readonly cacheService: TypeOrmQueryCacheService,
    private readonly slowQueryMonitor?: SlowQueryMonitorService,
    queryRunner?: QueryRunner,
  ) {
    super(target, dataSource.manager, queryRunner);
  }

  /**
   * Create query builder with caching support
   */
  createQueryBuilder(
    alias?: string,
    queryRunner?: QueryRunner,
  ): SelectQueryBuilder<Entity> {
    const qb = super.createQueryBuilder(alias, queryRunner);
    return qb;
  }

  /**
   * Execute cached query with automatic cache management
   */
  async executeCachedQuery<T = any>(
    query: string,
    parameters?: any[],
    options?: QueryCacheOptions,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      // Check cache first for SELECT queries
      if (this.isSelectQuery(query) && !options?.skipCache) {
        const cachedResult = await this.cacheService.get(
          query,
          parameters,
          options?.keyGenerator,
        );
        if (cachedResult !== null) {
          const duration = Date.now() - startTime;
          this.logger.debug(`Query served from cache in ${duration}ms`);
          return cachedResult;
        }
      }

      // Execute query using manager
      const result = await this.manager.query(query, parameters);
      const duration = Date.now() - startTime;

      // Cache result for SELECT queries
      if (this.isSelectQuery(query) && !options?.skipCache) {
        await this.cacheService.set(query, parameters, result, {
          ...options,
          ttl: options?.ttl || this.getDefaultTTL(),
          tags: options?.tags || this.getDefaultTags(),
        });
      }

      // Log slow queries using SlowQueryMonitorService
      if (
        this.slowQueryMonitor &&
        this.slowQueryMonitor.shouldMonitorQuery(query)
      ) {
        if (duration >= this.slowQueryMonitor.getSlowQueryThreshold()) {
          this.slowQueryMonitor.logSlowQuery({
            query,
            parameters,
            duration,
            timestamp: new Date(),
            repository: this.constructor.name,
            stackTrace: new Error().stack,
          });
        }
      }

      // Also log locally for immediate visibility
      if (duration > 1000) {
        this.logger.warn(
          `Slow query detected (${duration}ms): ${this.truncateQuery(query)}`,
          {
            query: this.truncateQuery(query),
            parameters,
            duration,
            repository: this.constructor.name,
          },
        );
      } else if (duration > 500) {
        this.logger.debug(
          `Query executed in ${duration}ms: ${this.truncateQuery(query)}`,
        );
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Query failed after ${duration}ms: ${this.truncateQuery(query)}`,
        {
          query: this.truncateQuery(query),
          parameters,
          duration,
          error: error.message,
          repository: this.constructor.name,
        },
      );
      throw error;
    }
  }

  /**
   * Find with automatic caching
   */
  async findCached(
    options?: any,
    cacheOptions?: QueryCacheOptions,
  ): Promise<Entity[]> {
    const qb = this.createQueryBuilder('entity');

    // Apply find options to query builder
    if (options?.where) {
      qb.where(options.where);
    }
    if (options?.order) {
      Object.entries(options.order).forEach(([field, direction]) => {
        qb.addOrderBy(`entity.${field}`, direction as 'ASC' | 'DESC');
      });
    }
    if (options?.take) {
      qb.take(options.take);
    }
    if (options?.skip) {
      qb.skip(options.skip);
    }

    const query = qb.getQuery();
    const parameters = qb.getParameters();

    return this.executeCachedQuery(
      query,
      Object.values(parameters),
      cacheOptions,
    );
  }

  /**
   * Find one with automatic caching
   */
  async findOneCached(
    options?: any,
    cacheOptions?: QueryCacheOptions,
  ): Promise<Entity | null> {
    const results = await this.findCached(
      { ...options, take: 1 },
      cacheOptions,
    );
    return results[0] || null;
  }

  /**
   * Count with automatic caching
   */
  async countCached(
    options?: any,
    cacheOptions?: QueryCacheOptions,
  ): Promise<number> {
    const qb = this.createQueryBuilder('entity');

    if (options?.where) {
      qb.where(options.where);
    }

    const query = qb.select('COUNT(*)', 'count').getQuery();
    const parameters = qb.getParameters();

    const result = await this.executeCachedQuery(
      query,
      Object.values(parameters),
      {
        ...cacheOptions,
        ttl: cacheOptions?.ttl || 120, // Shorter TTL for counts
        tags: [...(cacheOptions?.tags || []), 'statistics'],
      },
    );

    return parseInt(result[0]?.count || '0', 10);
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateCache(tags: string[]): Promise<void> {
    await this.cacheService.invalidateByTags(tags);
    this.logger.debug(`Invalidated cache for tags: ${tags.join(', ')}`);
  }

  /**
   * Warm up cache with predefined queries
   */
  async warmUpCache(
    queries: Array<{
      query: string;
      parameters?: any[];
      options?: QueryCacheOptions;
    }>,
  ): Promise<void> {
    this.logger.log(
      `Warming up cache for ${this.constructor.name} with ${queries.length} queries`,
    );

    for (const { query, parameters = [], options = {} } of queries) {
      try {
        await this.executeCachedQuery(query, parameters, options);
      } catch (error) {
        this.logger.error(
          `Failed to warm up cache for query: ${this.truncateQuery(query)}`,
          error,
        );
      }
    }
  }

  /**
   * Get cache statistics for this repository
   */
  async getCacheStats() {
    return this.cacheService.getStats();
  }

  /**
   * Check if query is a SELECT query
   */
  private isSelectQuery(query: string): boolean {
    const normalizedQuery = query.trim().toLowerCase();
    return (
      normalizedQuery.startsWith('select') || normalizedQuery.startsWith('with')
    ); // CTE queries
  }

  /**
   * Get default TTL based on entity type
   */
  private getDefaultTTL(): number {
    // Can be overridden in specific repositories
    return 300; // 5 minutes default
  }

  /**
   * Get default cache tags based on entity type
   */
  private getDefaultTags(): string[] {
    // Can be overridden in specific repositories
    const entityName = this.metadata.name.toLowerCase();
    return [entityName];
  }

  /**
   * Truncate query for logging
   */
  private truncateQuery(query: string): string {
    return query.length > 200 ? `${query.substring(0, 200)}...` : query;
  }
}
