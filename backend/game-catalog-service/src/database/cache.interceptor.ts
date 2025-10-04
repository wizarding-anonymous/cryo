import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisConfigService } from './redis-config.service';
import { CACHE_KEY_METADATA, CACHE_TTL_METADATA } from './cache.decorator';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly redisService: RedisConfigService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const cacheKey = this.reflector.get<string>(
      CACHE_KEY_METADATA,
      context.getHandler(),
    );
    const cacheTtl = this.reflector.get<number>(
      CACHE_TTL_METADATA,
      context.getHandler(),
    );

    if (!cacheKey || !this.redisService.isAvailable()) {
      return next.handle();
    }

    // Build cache key from pattern and request parameters
    const request = context.switchToHttp().getRequest();
    const resolvedKey = this.resolveCacheKey(cacheKey, {
      ...request.params,
      ...request.query,
    });

    try {
      // Try to get from cache
      const cachedResult = await this.redisService.get(resolvedKey);
      if (cachedResult !== null) {
        this.logger.debug(`Cache hit: ${resolvedKey}`);
        return of(cachedResult);
      }

      // Cache miss - execute handler and cache result
      this.logger.debug(`Cache miss: ${resolvedKey}`);
      return next.handle().pipe(
        tap(async (result) => {
          if (result !== null && result !== undefined) {
            await this.redisService.set(resolvedKey, result, cacheTtl || 300);
            this.logger.debug(`Cached result: ${resolvedKey}`);
          }
        }),
      );
    } catch (error) {
      this.logger.error(`Cache error for key ${resolvedKey}:`, error);
      return next.handle();
    }
  }

  private resolveCacheKey(pattern: string, params: Record<string, any>): string {
    let resolvedKey = pattern;
    
    // Replace {param} placeholders with actual values
    Object.keys(params).forEach((key) => {
      const placeholder = `{${key}}`;
      if (resolvedKey.includes(placeholder)) {
        resolvedKey = resolvedKey.replace(placeholder, String(params[key]));
      }
    });

    return resolvedKey;
  }
}