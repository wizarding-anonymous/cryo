import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Inject,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  CACHE_KEY_METADATA,
  CACHE_INVALIDATE_METADATA,
  CACHE_TTL_METADATA,
} from '../decorators/cache.decorator';

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpCacheInterceptor.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const handler = context.getHandler();
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    // --- Cache Invalidation Logic ---
    const invalidatePatterns = this.reflector.get<string[]>(
      CACHE_INVALIDATE_METADATA,
      handler,
    );

    if (invalidatePatterns) {
      this.logger.debug(`Cache invalidation requested for patterns: ${invalidatePatterns.join(', ')}`);
      return next.handle().pipe(
        tap(async () => {
          for (const pattern of invalidatePatterns) {
            const key = this.generateKey(pattern, request);
            try {
              await this.cacheManager.del(key);
              this.logger.debug(`Cache invalidated for key: ${key}`);
            } catch (error) {
              this.logger.warn(`Failed to invalidate cache key ${key}: ${error.message}`);
            }
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
      const cachedValue = await this.cacheManager.get(cacheKey);
      if (cachedValue) {
        const responseTime = Date.now() - startTime;
        this.logger.debug(`Cache HIT for key: ${cacheKey} (${responseTime}ms)`);
        
        // Mark request as cache hit for performance monitoring
        request.cacheHit = true;
        
        return of(cachedValue);
      }
    } catch (error) {
      this.logger.warn(`Cache retrieval failed for key ${cacheKey}: ${error.message}`);
    }

    this.logger.debug(`Cache MISS for key: ${cacheKey}`);

    return next.handle().pipe(
      tap(async (response) => {
        try {
          const ttl = customTtl || 300; // Default 5 minutes
          await this.cacheManager.set(cacheKey, response, ttl * 1000);
          const responseTime = Date.now() - startTime;
          this.logger.debug(`Cache SET for key: ${cacheKey}, TTL: ${ttl}s (${responseTime}ms)`);
        } catch (error) {
          this.logger.warn(`Cache storage failed for key ${cacheKey}: ${error.message}`);
        }
      }),
    );
  }

  private generateKey(pattern: string, request: any): string {
    let key = pattern;
    
    // Replace parameter placeholders
    if (request.params) {
      for (const param in request.params) {
        key = key.replace(`{{params.${param}}}`, request.params[param]);
      }
    }
    
    // Replace query placeholders
    if (request.query) {
      // Handle special case for query object serialization
      if (key.includes('{{query}}')) {
        const queryString = this.serializeQuery(request.query);
        key = key.replace('{{query}}', queryString);
      } else {
        for (const q in request.query) {
          key = key.replace(`{{query.${q}}}`, request.query[q]);
        }
      }
    }
    
    // Add namespace prefix for better organization
    return `game-catalog:${key}`;
  }

  private serializeQuery(query: any): string {
    const sortedKeys = Object.keys(query).sort();
    const pairs = sortedKeys.map(key => `${key}=${query[key]}`);
    return pairs.join('&');
  }
}
