import { Injectable, Logger } from '@nestjs/common';
import { Connection, QueryRunner } from 'typeorm';
import { TypeOrmQueryCacheService } from '../common/cache/typeorm-query-cache.service';
import { CachedQueryRunner } from '../common/cache/cached-query-runner';

/**
 * TypeORM Cache Connection Provider
 * Provides cached query runners that integrate with our Redis-based query cache
 */
@Injectable()
export class TypeOrmCacheConnectionProvider {
  private readonly logger = new Logger(TypeOrmCacheConnectionProvider.name);

  constructor(private readonly cacheService: TypeOrmQueryCacheService) {}

  /**
   * Create a cached query runner that wraps the original TypeORM query runner
   */
  createCachedQueryRunner(connection: Connection): QueryRunner {
    const originalQueryRunner = connection.createQueryRunner();
    const cachedQueryRunner = new CachedQueryRunner(
      originalQueryRunner,
      this.cacheService,
    );

    this.logger.debug('Created cached query runner');
    return cachedQueryRunner as any; // Type assertion for compatibility
  }

  /**
   * Wrap existing query runner with caching capabilities
   */
  wrapQueryRunner(queryRunner: QueryRunner): QueryRunner {
    if (queryRunner instanceof CachedQueryRunner) {
      return queryRunner; // Already wrapped
    }

    const cachedQueryRunner = new CachedQueryRunner(
      queryRunner,
      this.cacheService,
    );
    this.logger.debug('Wrapped existing query runner with caching');
    return cachedQueryRunner as any;
  }
}
