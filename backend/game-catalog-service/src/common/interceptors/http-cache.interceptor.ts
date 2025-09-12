import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  CACHE_KEY_METADATA,
  CACHE_INVALIDATE_METADATA,
} from '../decorators/cache.decorator';

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
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

    // --- Cache Invalidation Logic ---
    const invalidatePatterns = this.reflector.get<string[]>(
      CACHE_INVALIDATE_METADATA,
      handler,
    );

    if (invalidatePatterns) {
      return next.handle().pipe(
        tap(async () => {
          for (const pattern of invalidatePatterns) {
            const key = this.generateKey(pattern, request);
            // await this.cacheManager.del(key); // Temporarily disabled due to library incompatibility
          }
        }),
      );
    }

    // --- Cache Retrieval Logic ---
    const cacheKeyPattern = this.reflector.get<string>(CACHE_KEY_METADATA, handler);
    if (!cacheKeyPattern) {
      return next.handle();
    }

    const cacheKey = this.generateKey(cacheKeyPattern, request);

    try {
      const cachedValue = await this.cacheManager.get(cacheKey);
      if (cachedValue) {
        return of(cachedValue);
      }
    } catch (error) {
      // Proceed without cache if store is unavailable
    }

    return next.handle().pipe(
      tap(async (response) => {
        try {
          await this.cacheManager.set(cacheKey, response, 300 * 1000); // 5 min TTL
        } catch (error) {
          // Do not throw if cache store is unavailable
        }
      }),
    );
  }

  private generateKey(pattern: string, request: any): string {
    let key = pattern;
    if (request.params) {
      for (const param in request.params) {
        key = key.replace(`{{params.${param}}}`, request.params[param]);
      }
    }
    if (request.query) {
      for (const q in request.query) {
        key = key.replace(`{{query.${q}}}`, request.query[q]);
      }
    }
    return key;
  }
}
