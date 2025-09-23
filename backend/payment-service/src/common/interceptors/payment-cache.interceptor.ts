import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class PaymentCacheInterceptor implements NestInterceptor {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    // Only cache GET requests
    if (method !== 'GET') {
      return next.handle();
    }

    // Generate cache key based on URL and user ID
    const userId = request.user?.userId;
    const cacheKey = `payment:${url}:${userId}`;

    // Try to get from cache
    const cachedResult = await this.cacheManager.get(cacheKey);
    if (cachedResult) {
      return of(cachedResult);
    }

    // If not in cache, execute request and cache result
    return next.handle().pipe(
      tap(async (data) => {
        // Cache payment data for 2 minutes (payments can change status)
        // Cache order data for 5 minutes (orders change less frequently)
        const ttl = url.includes('/payments/') ? 120 : 300;
        await this.cacheManager.set(cacheKey, data, ttl * 1000);
      }),
    );
  }
}
