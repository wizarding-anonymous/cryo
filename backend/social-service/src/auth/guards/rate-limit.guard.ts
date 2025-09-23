import { CanActivate, ExecutionContext, Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RateLimitExceededException } from '../../common/exceptions/rate-limit-exceeded.exception';

const MESSAGE_LIMIT = 20; // 20 messages
const TIME_WINDOW_SECONDS = 60; // per minute

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      // Should be handled by JwtAuthGuard, but as a safeguard
      return true;
    }

    const key = `rate-limit:messages:${userId}`;
    const currentCount = await this.cacheManager.get<number>(key);

    if (currentCount === undefined || currentCount === null) {
      // Using the cache 'ttl' argument might not work as expected for incrementing.
      // It's better to set it once with a specific TTL.
      // Here we assume the cache entry will expire on its own.
      await this.cacheManager.set(key, 1, { ttl: TIME_WINDOW_SECONDS } as any);
      return true;
    }

    if (currentCount >= MESSAGE_LIMIT) {
      throw new RateLimitExceededException(MESSAGE_LIMIT);
    }

    const store: any = (this.cacheManager as any).store;
    const ttlGetter = typeof store?.ttl === 'function' ? store.ttl.bind(store) : undefined;
    const ttl = ttlGetter ? await ttlGetter(key) : TIME_WINDOW_SECONDS;
    await this.cacheManager.set(key, currentCount + 1, { ttl } as any);
    return true;
  }
}
