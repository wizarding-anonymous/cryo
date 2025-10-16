import { Logger } from '@nestjs/common';
import { QueryRunner, QueryResult } from 'typeorm';
import {
  TypeOrmQueryCacheService,
  QueryCacheOptions,
} from './typeorm-query-cache.service';

/**
 * Cached Query Runner
 * Wraps TypeORM QueryRunner to provide intelligent query caching
 */
export class CachedQueryRunner {
  private readonly logger = new Logger(CachedQueryRunner.name);

  constructor(
    private readonly queryRunner: QueryRunner,
    private readonly cacheService: TypeOrmQueryCacheService,
  ) {}

  /**
   * Execute query with caching support
   */
  async query(
    query: string,
    parameters?: any[],
    cacheOptions?: QueryCacheOptions,
  ): Promise<any> {
    const startTime = Date.now();

    try {
      // Check cache first (only for SELECT queries)
      if (this.isSelectQuery(query) && !cacheOptions?.skipCache) {
        const cachedResult = await this.cacheService.get(query, parameters);
        if (cachedResult !== null) {
          const duration = Date.now() - startTime;
          this.logger.debug(`Query served from cache in ${duration}ms`);
          return cachedResult;
        }
      }

      // Execute query
      const result = await this.queryRunner.query(query, parameters);
      const duration = Date.now() - startTime;

      // Cache result if it's a SELECT query and caching is enabled
      if (this.isSelectQuery(query) && !cacheOptions?.skipCache) {
        await this.cacheService.set(query, parameters, result, {
          ...cacheOptions,
          ttl: cacheOptions?.ttl || this.getTTLForQuery(query),
          tags: cacheOptions?.tags || this.getTagsForQuery(query),
        });
      }

      // Log slow queries
      if (duration > 1000) {
        this.logger.warn(
          `Slow query executed in ${duration}ms: ${this.truncateQuery(query)}`,
        );
      } else {
        this.logger.debug(`Query executed in ${duration}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Query failed after ${duration}ms: ${this.truncateQuery(query)}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Execute query and return QueryResult
   */
  async queryResult(
    query: string,
    parameters?: any[],
    cacheOptions?: QueryCacheOptions,
  ): Promise<QueryResult> {
    const result = await this.query(query, parameters, cacheOptions);

    // Convert to QueryResult format
    return {
      records: Array.isArray(result) ? result : [result],
      raw: result,
    } as QueryResult;
  }

  /**
   * Start transaction (delegates to original query runner)
   */
  async startTransaction(
    isolationLevel?:
      | 'READ UNCOMMITTED'
      | 'READ COMMITTED'
      | 'REPEATABLE READ'
      | 'SERIALIZABLE',
  ): Promise<void> {
    return this.queryRunner.startTransaction(isolationLevel);
  }

  /**
   * Commit transaction (delegates to original query runner)
   */
  async commitTransaction(): Promise<void> {
    return this.queryRunner.commitTransaction();
  }

  /**
   * Rollback transaction (delegates to original query runner)
   */
  async rollbackTransaction(): Promise<void> {
    return this.queryRunner.rollbackTransaction();
  }

  /**
   * Release query runner (delegates to original query runner)
   */
  async release(): Promise<void> {
    return this.queryRunner.release();
  }

  /**
   * Check if query runner is released
   */
  get isReleased(): boolean {
    return this.queryRunner.isReleased;
  }

  /**
   * Check if transaction is active
   */
  get isTransactionActive(): boolean {
    return this.queryRunner.isTransactionActive;
  }

  /**
   * Get connection from query runner
   */
  get connection() {
    return this.queryRunner.connection;
  }

  /**
   * Get manager from query runner
   */
  get manager() {
    return this.queryRunner.manager;
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
   * Get appropriate TTL for query based on query type
   */
  private getTTLForQuery(query: string): number {
    const normalizedQuery = query.toLowerCase();

    // User profile queries - cache longer
    if (
      normalizedQuery.includes('users') &&
      (normalizedQuery.includes('preferences') ||
        normalizedQuery.includes('privacy_settings'))
    ) {
      return 600; // 10 minutes
    }

    // User lookup queries - cache medium
    if (
      normalizedQuery.includes('users') &&
      normalizedQuery.includes('where')
    ) {
      return 300; // 5 minutes
    }

    // Count queries - cache shorter
    if (normalizedQuery.includes('count(')) {
      return 120; // 2 minutes
    }

    // Statistics queries - cache very short
    if (
      normalizedQuery.includes('sum(') ||
      normalizedQuery.includes('avg(') ||
      normalizedQuery.includes('max(') ||
      normalizedQuery.includes('min(')
    ) {
      return 60; // 1 minute
    }

    // Default TTL
    return 180; // 3 minutes
  }

  /**
   * Get appropriate tags for query based on tables involved
   */
  private getTagsForQuery(query: string): string[] {
    const tags: string[] = [];
    const normalizedQuery = query.toLowerCase();

    // Add table-based tags
    if (normalizedQuery.includes('users')) {
      tags.push('users');
    }

    // Add operation-based tags
    if (normalizedQuery.includes('count(')) {
      tags.push('statistics');
    }

    if (normalizedQuery.includes('preferences')) {
      tags.push('preferences');
    }

    if (normalizedQuery.includes('privacy_settings')) {
      tags.push('privacy');
    }

    // Add time-based tags for queries with date filters
    if (
      normalizedQuery.includes('created_at') ||
      normalizedQuery.includes('updated_at') ||
      normalizedQuery.includes('last_login_at')
    ) {
      tags.push('time-sensitive');
    }

    return tags;
  }

  /**
   * Truncate query for logging
   */
  private truncateQuery(query: string): string {
    return query.length > 200 ? `${query.substring(0, 200)}...` : query;
  }
}
