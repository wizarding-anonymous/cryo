import {
  Injectable,
  ExecutionContext,
  CallHandler,
  Inject,
  Logger,
} from '@nestjs/common';
import {
  CacheInterceptor as NestCacheInterceptor,
  CACHE_MANAGER,
} from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import type { Cache } from 'cache-manager';

/**
 * Enhanced Cache Interceptor for automatic caching of GET requests
 * Features:
 * - User-specific cache keys
 * - Configurable TTL based on endpoint
 * - Cache invalidation tracking
 * - Error handling for cache operations
 */
@Injectable()
export class CacheInterceptor extends NestCacheInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    @Inject(CACHE_MANAGER) cacheManager: Cache,
    reflector: Reflector,
  ) {
    super(cacheManager, reflector);
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const key = this.trackBy(context);
    if (!key) {
      return next.handle();
    }

    try {
      const cachedValue = await this.cacheManager.get(key);
      if (cachedValue) {
        this.logger.debug(`Cache hit for key: ${key}`);
        return of(cachedValue);
      }
    } catch (error) {
      this.logger.warn(`Cache get failed for key ${key}:`, error);
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const userCacheKeysKey = `user-cache-keys:${userId}`;

    return next.handle().pipe(
      tap(async (response) => {
        try {
          const ttl = this.getTTL(request.originalUrl);
          await this.cacheManager.set(key, response, ttl);
          this.logger.debug(
            `Cached response for key: ${key} with TTL: ${ttl}s`,
          );

          // Track user-specific cache keys for invalidation
          if (userId && key.startsWith(`cache:${userId}:/api/library/my`)) {
            const userKeys =
              (await this.cacheManager.get(userCacheKeysKey)) || [];
            if (!userKeys.includes(key)) {
              userKeys.push(key);
              await this.cacheManager.set(userCacheKeysKey, userKeys, 0);
            }
          }
        } catch (error) {
          this.logger.warn(`Cache set failed for key ${key}:`, error);
        }
      }),
      catchError((error) => {
        this.logger.error(`Request failed for key ${key}:`, error);
        throw error;
      }),
    );
  }

  trackBy(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest();
    const { user, originalUrl, method } = request;

    // Only cache GET requests
    if (method !== 'GET') {
      return undefined;
    }

    // Skip caching for health checks and metrics
    if (originalUrl.includes('/health') || originalUrl.includes('/metrics')) {
      return undefined;
    }

    // Generate user-specific cache key
    if (user && user.id) {
      return `cache:${user.id}:${originalUrl}`;
    }

    // Generate anonymous cache key for public endpoints
    return `cache:anonymous:${originalUrl}`;
  }

  /**
   * Get TTL based on endpoint type
   */
  private getTTL(url: string): number {
    // Library data - 5 minutes
    if (url.includes('/api/library/my')) {
      return 300;
    }

    // Search results - 2 minutes
    if (url.includes('/search')) {
      return 120;
    }

    // History data - 10 minutes
    if (url.includes('/history')) {
      return 600;
    }

    // Game details - 30 minutes
    if (url.includes('/games/')) {
      return 1800;
    }

    // Default TTL - 5 minutes
    return 300;
  }
}
