import { Injectable, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { CacheInterceptor as NestCacheInterceptor, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheInterceptor extends NestCacheInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) cacheManager: Cache,
    reflector: Reflector
  ) {
    super(cacheManager, reflector);
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const key = this.trackBy(context);
    if (!key) {
      return next.handle();
    }

    const cachedValue = await this.cacheManager.get(key);
    if (cachedValue) {
      return of(cachedValue);
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const userCacheKeysKey = `user-cache-keys:${userId}`;

    return next.handle().pipe(
      tap(async (response) => {
        await this.cacheManager.set(key, response, 300); // 5 minutes TTL

        if (userId && key.startsWith(`cache:${userId}:/api/library/my`)) {
            const userKeys = await this.cacheManager.get(userCacheKeysKey) || [];
            if (!userKeys.includes(key)) {
                userKeys.push(key);
                await this.cacheManager.set(userCacheKeysKey, userKeys, 0); // Store indefinitely
            }
        }
      }),
    );
  }

  trackBy(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest();
    const { user, originalUrl } = request;

    if (request.method !== 'GET') {
        return undefined;
    }

    if (user && user.id) {
      return `cache:${user.id}:${originalUrl}`;
    }

    return originalUrl;
  }
}
