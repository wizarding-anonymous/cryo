import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { TypeOrmQueryCacheService } from './typeorm-query-cache.service';

/**
 * Cache Invalidation Interceptor
 * Automatically invalidates cache entries based on @InvalidateCache decorator metadata
 */
@Injectable()
export class CacheInvalidationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInvalidationInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: TypeOrmQueryCacheService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const invalidateTags = this.reflector.get<string[]>(
      'invalidate_cache',
      context.getHandler(),
    );

    // If no invalidation metadata, proceed without invalidation
    if (!invalidateTags || invalidateTags.length === 0) {
      return next.handle();
    }

    const methodName = context.getHandler().name;
    const className = context.getClass().name;

    return next.handle().pipe(
      tap(async (result) => {
        try {
          // Invalidate cache after successful operation
          const invalidatedCount =
            await this.cacheService.invalidateByTags(invalidateTags);

          if (invalidatedCount > 0) {
            this.logger.log(
              `Invalidated ${invalidatedCount} cache entries after ${className}.${methodName} ` +
                `(tags: ${invalidateTags.join(', ')})`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error invalidating cache after ${className}.${methodName}:`,
            error,
          );
          // Don't throw error - cache invalidation failure shouldn't break the operation
        }
      }),
      catchError((error) => {
        this.logger.debug(
          `Skipping cache invalidation due to error in ${className}.${methodName}`,
        );
        throw error;
      }),
    );
  }
}
