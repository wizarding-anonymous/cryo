import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DataSource, QueryRunner } from 'typeorm';
import { TypeOrmQueryCacheService } from '../common/cache/typeorm-query-cache.service';
import { CachedQueryRunner } from '../common/cache/cached-query-runner';

/**
 * TypeORM Cache Interceptor
 * Automatically wraps TypeORM query runners with caching capabilities
 */
@Injectable()
export class TypeOrmCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TypeOrmCacheInterceptor.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly cacheService: TypeOrmQueryCacheService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Add cache service to request for repositories to use
    if (request) {
      request.typeormCacheService = this.cacheService;
    }

    return next.handle().pipe(
      tap(() => {
        // Log cache statistics periodically
        this.logCacheStatistics();
      }),
    );
  }

  /**
   * Log cache statistics periodically
   */
  private async logCacheStatistics(): Promise<void> {
    try {
      // Only log every 100th request to avoid spam
      if (Math.random() < 0.01) {
        const stats = await this.cacheService.getStats();
        this.logger.debug('TypeORM Query Cache Statistics', {
          hits: stats.hits,
          misses: stats.misses,
          hitRate: `${stats.hitRate.toFixed(2)}%`,
          totalQueries: stats.totalQueries,
          cacheSize: stats.cacheSize,
          memoryUsage: `${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`,
        });
      }
    } catch (error) {
      this.logger.error('Error logging cache statistics:', error);
    }
  }
}
