import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { TypeOrmQueryCacheService } from './typeorm-query-cache.service';
import { CACHE_QUERY_KEY, CacheQueryMetadata } from './cache-query.decorator';

/**
 * Query Cache Interceptor
 * Automatically caches method results based on @CacheQuery decorator metadata
 */
@Injectable()
export class QueryCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(QueryCacheInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: TypeOrmQueryCacheService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const cacheMetadata = this.reflector.get<CacheQueryMetadata>(
      CACHE_QUERY_KEY,
      context.getHandler(),
    );

    // If no cache metadata, proceed without caching
    if (!cacheMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const methodName = context.getHandler().name;
    const className = context.getClass().name;
    const args = context.getArgs();

    // Check condition if provided
    if (cacheMetadata.condition && !cacheMetadata.condition(...args)) {
      this.logger.debug(
        `Cache condition not met for ${className}.${methodName}`,
      );
      return next.handle();
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(
      className,
      methodName,
      args,
      cacheMetadata.keyGenerator,
    );

    try {
      // Try to get from cache
      const cachedResult = await this.cacheService.get(cacheKey, []);

      if (cachedResult !== null) {
        this.logger.debug(`Cache hit for ${className}.${methodName}`);
        return of(cachedResult);
      }

      // Cache miss - execute method and cache result
      this.logger.debug(`Cache miss for ${className}.${methodName}`);

      return next.handle().pipe(
        tap(async (result) => {
          // Cache the result
          await this.cacheService.set(cacheKey, [], result, {
            ttl: cacheMetadata.ttl,
            tags: cacheMetadata.tags ? [...cacheMetadata.tags] : undefined,
          });

          this.logger.debug(`Cached result for ${className}.${methodName}`);
        }),
        catchError((error) => {
          this.logger.error(`Error in ${className}.${methodName}:`, error);
          throw error;
        }),
      );
    } catch (error) {
      this.logger.error(`Cache error for ${className}.${methodName}:`, error);
      // If cache fails, proceed without caching
      return next.handle();
    }
  }

  /**
   * Generate cache key for method call
   */
  private generateCacheKey(
    className: string,
    methodName: string,
    args: any[],
    keyGenerator?: (...args: any[]) => string,
  ): string {
    if (keyGenerator) {
      try {
        const customKey = keyGenerator(...args);
        return `${className}.${methodName}:${customKey}`;
      } catch (error) {
        this.logger.warn(
          'Error in custom key generator, falling back to default',
        );
      }
    }

    // Default key generation
    const argsString = this.serializeArgs(args);
    return `${className}.${methodName}:${argsString}`;
  }

  /**
   * Serialize arguments for cache key
   */
  private serializeArgs(args: any[]): string {
    try {
      // Filter out complex objects and functions
      const serializable = args.map((arg) => {
        if (arg === null || arg === undefined) {
          return arg;
        }

        if (
          typeof arg === 'string' ||
          typeof arg === 'number' ||
          typeof arg === 'boolean'
        ) {
          return arg;
        }

        if (Array.isArray(arg)) {
          return arg.slice(0, 10); // Limit array size for key
        }

        if (typeof arg === 'object') {
          // Only include simple properties
          const simple: any = {};
          for (const [key, value] of Object.entries(arg)) {
            if (
              typeof value === 'string' ||
              typeof value === 'number' ||
              typeof value === 'boolean'
            ) {
              simple[key] = value;
            }
          }
          return simple;
        }

        return String(arg);
      });

      return JSON.stringify(serializable);
    } catch (error) {
      // Fallback to string representation
      return args.map((arg) => String(arg)).join(':');
    }
  }
}
