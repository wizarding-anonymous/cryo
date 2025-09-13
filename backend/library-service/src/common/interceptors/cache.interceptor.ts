import { Injectable, ExecutionContext, CallHandler } from '@nestjs/common';
import { CacheInterceptor as NestCacheInterceptor } from '@nestjs/cache-manager';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class CacheInterceptor extends NestCacheInterceptor {

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
        await this.cacheManager.set(key, response, this.options.ttl);

        if (userId && key.startsWith(`cache:${userId}:/api/library/my`)) {
            const userKeys = await this.cacheManager.get<string[]>(userCacheKeysKey) || [];
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
