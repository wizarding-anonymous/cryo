import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Inject,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { Request } from 'express';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) { }

    async intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Promise<Observable<any>> {
        const request = context.switchToHttp().getRequest<Request>();
        const { method, url } = request;

        // Only cache GET requests
        if (method !== 'GET') {
            return next.handle();
        }

        // Generate cache key based on URL and user
        const userId = (request as any).user?.id || 'anonymous';
        const cacheKey = `${method}:${url}:${userId}`;

        // Try to get cached response
        const cachedResponse = await this.cacheManager.get(cacheKey);
        if (cachedResponse) {
            return of(cachedResponse);
        }

        // If not cached, proceed with request and cache the response
        return next.handle().pipe(
            tap(async (response) => {
                // Cache for different durations based on endpoint
                let ttl = 300; // 5 minutes default

                if (url.includes('/achievements') && !url.includes('/user/')) {
                    // Cache all achievements for longer (30 minutes)
                    ttl = 1800;
                } else if (url.includes('/user/')) {
                    // Cache user-specific data for shorter time (2 minutes)
                    ttl = 120;
                }

                await this.cacheManager.set(cacheKey, response, ttl * 1000);
            }),
        );
    }
}