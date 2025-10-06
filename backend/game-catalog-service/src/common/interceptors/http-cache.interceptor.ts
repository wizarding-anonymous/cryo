import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisConfigService } from '../../database/redis-config.service';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import {
  CACHE_KEY_METADATA,
  CACHE_INVALIDATE_METADATA,
  CACHE_TTL_METADATA,
} from '../decorators/cache.decorator';

interface RequestWithCache extends Request {
  cacheHit?: boolean;
}

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpCacheInterceptor.name);

  constructor(
    private readonly redisService: RedisConfigService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const handler = context.getHandler();
    const request = context.switchToHttp().getRequest<RequestWithCache>();
    const startTime = Date.now();

    // --- Cache Invalidation Logic ---
    const invalidatePatterns = this.reflector.get<string[]>(
      CACHE_INVALIDATE_METADATA,
      handler,
    );

    if (invalidatePatterns) {
      this.logger.debug(
        `Cache invalidation requested for patterns: ${invalidatePatterns.join(', ')}`,
      );
      return next.handle().pipe(
        tap(() => {
          for (const pattern of invalidatePatterns) {
            const key = this.generateKey(pattern, request);
            void this.redisService
              .del(key)
              .then(() => {
                this.logger.debug(`Cache invalidated for key: ${key}`);
              })
              .catch((error) => {
                this.logger.warn(
                  `Failed to invalidate cache key ${key}: ${(error as Error).message}`,
                );
              });
          }
        }),
      );
    }

    // --- Cache Retrieval Logic ---
    const cacheKeyPattern = this.reflector.get<string>(
      CACHE_KEY_METADATA,
      handler,
    );
    if (!cacheKeyPattern) {
      return next.handle();
    }

    const cacheKey = this.generateKey(cacheKeyPattern, request);
    const customTtl = this.reflector.get<number>(CACHE_TTL_METADATA, handler);

    try {
      const cachedValue = await this.redisService.get(cacheKey);
      if (cachedValue) {
        const responseTime = Date.now() - startTime;
        this.logger.debug(`Cache HIT for key: ${cacheKey} (${responseTime}ms)`);

        // Mark request as cache hit for performance monitoring
        (request as Record<string, any>).cacheHit = true;

        return of(cachedValue);
      }
    } catch (error) {
      this.logger.warn(
        `Cache retrieval failed for key ${cacheKey}: ${(error as Error).message}`,
      );
    }

    this.logger.debug(`Cache MISS for key: ${cacheKey}`);

    return next.handle().pipe(
      tap((response) => {
        const ttl = customTtl || 300; // Default 5 minutes
        void this.redisService
          .set(cacheKey, response, ttl)
          .then(() => {
            const responseTime = Date.now() - startTime;
            this.logger.debug(
              `Cache SET for key: ${cacheKey}, TTL: ${ttl}s (${responseTime}ms)`,
            );
          })
          .catch((error) => {
            this.logger.warn(
              `Cache storage failed for key ${cacheKey}: ${(error as Error).message}`,
            );
          });
      }),
    );
  }

  private generateKey(pattern: string, request: RequestWithCache): string {
    let key = pattern;

    // Replace parameter placeholders
    const params = request.params;
    if (params && typeof params === 'object') {
      for (const param in params) {
        key = key.replace(`{{params.${param}}}`, String(params[param]));
      }
    }

    // Replace query placeholders
    const query = request.query;
    if (query && typeof query === 'object') {
      // Handle special case for query object serialization
      if (key.includes('{{query}}')) {
        const queryString = this.serializeQuery(
          query as Record<string, unknown>,
        );
        key = key.replace('{{query}}', queryString);
      } else {
        for (const q in query) {
          const value = query[q];
          let stringValue: string;
          if (typeof value === 'object' && value !== null) {
            stringValue = JSON.stringify(value);
          } else if (
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'
          ) {
            stringValue = String(value);
          } else {
            stringValue = '';
          }
          key = key.replace(`{{query.${q}}}`, stringValue);
        }
      }
    }

    // Add namespace prefix for better organization
    return `game-catalog:${key}`;
  }

  private serializeQuery(query: Record<string, unknown>): string {
    const sortedKeys = Object.keys(query).sort();
    const pairs = sortedKeys.map((key) => {
      const value = query[key];
      let stringValue: string;
      if (typeof value === 'object' && value !== null) {
        stringValue = JSON.stringify(value);
      } else if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        stringValue = String(value);
      } else {
        stringValue = '';
      }
      return `${key}=${stringValue}`;
    });
    return pairs.join('&');
  }
}
